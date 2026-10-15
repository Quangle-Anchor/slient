/**
 * A mock of the backend, served by the Vite dev server itself.
 *
 * `npm run dev` mounts it at `/mock-api` (see `vite.config.ts`), and
 * `src/shared/api/constants.ts` points `API_URL` there, so the data provider,
 * the auth provider and every `useCustom` call run unchanged — they simply talk
 * to this instead of Spring Boot. It speaks the same dialect the backend does
 * (see "The API contract is the data provider's dialect" in CLAUDE.md):
 * bare-array lists with `X-Total-Count`, `_start`/`_end`/`_sort`/`_order`,
 * operator suffixes on filter keys, `q`, `ids[n]`, JSON error bodies, and
 * `X-Auth-Version` on every authenticated response.
 *
 * Permissions are enforced per `{resource}:{action}` exactly as `@PreAuthorize`
 * does, so signing in as `viewer` shows what a narrow account sees. Row-level
 * scopes are *not* applied to lists — the policy screens work, but every
 * account sees every row.
 *
 * State is in memory and resets whenever the dev server restarts.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import { createDatabase, createPremises, type Row } from "./data";

export const MOCK_API_PREFIX = "/mock-api";

/** Long enough to see a loading state, short enough not to be annoying. */
const LATENCY_MS = 150;

const db = createDatabase();
const premises = createPremises();
let policyGeneration = 1;

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: Record<string, string>
  ) {
    super(message);
  }
}

const notFound = (what: string, id: unknown) =>
  new HttpError(404, `${what} ${id} was not found`);

function invalid(errors: Record<string, string>): HttpError {
  return new HttpError(400, "Validation failed", errors);
}

type Json = Record<string, unknown>;

type Context = {
  method: string;
  segments: string[];
  query: URLSearchParams;
  body: Json;
  user: Row | null;
  res: ServerResponse;
};

function nextId(rows: Row[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function now(): string {
  return new Date().toISOString();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function byId(rows: Row[], id: unknown): Row | undefined {
  return rows.find((row) => row.id === Number(id));
}

/** `{id}` → id, `{id: null}` / `null` → null, absent → undefined. */
function refId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    return id === null || id === undefined || id === "" ? null : Number(id);
  }
  return value === "" ? null : Number(value);
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function getPath(object: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    return (current as Json)[key];
  }, object);
}

/** Applies a field only when the request carried it — PATCH semantics. */
function assign(row: Row, body: Json, fields: string[]) {
  for (const field of fields) {
    if (field in body) {
      row[field] = typeof body[field] === "string" ? str(body[field]) : body[field];
    }
  }
}

function required(body: Json, fields: Record<string, string>, creating: boolean) {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields)) {
    if ((creating || field in body) && !str(body[field])) {
      errors[field] = message;
    }
  }
  if (Object.keys(errors).length) throw invalid(errors);
}

// ---------------------------------------------------------------------------
// Authorities
// ---------------------------------------------------------------------------

function rolesOf(user: Row): Row[] {
  return (user.roleIds as number[]).map((id) => byId(db.roles, id)).filter(Boolean) as Row[];
}

function permissionsOf(user: Row): string[] {
  const ids = new Set(rolesOf(user).flatMap((role) => role.permissionIds as number[]));
  return db.permissions
    .filter((p) => ids.has(p.id))
    .map((p) => p.code as string)
    .sort();
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function authVersion(user: Row): string {
  return `${hash(permissionsOf(user).join(","))}.${policyGeneration}`;
}

function scopedResources(user: Row): string[] {
  const roleIds = new Set(user.roleIds as number[]);
  const resources = db.rowLevelPolicies
    .filter((p) => p.enabled && p.kind === "SCOPE" && p.action === "read" && roleIds.has(p.roleId as number))
    .map((p) => p.resource as string);
  return [...new Set(resources)];
}

function authorities(user: Row) {
  return {
    roles: rolesOf(user).map((r) => r.code),
    permissions: permissionsOf(user),
    version: authVersion(user),
    scopedResources: scopedResources(user),
  };
}

function requirePermission(ctx: Context, code: string) {
  if (!ctx.user) throw new HttpError(401, "Authentication required");
  if (!permissionsOf(ctx.user).includes(code)) {
    throw new HttpError(403, `You do not have permission to do this (${code})`);
  }
}

/**
 * Tokens carry the user id in the clear so they survive a dev-server restart;
 * in a mock nothing is gained by making them opaque.
 */
function issueTokens(user: Row) {
  const nonce = Math.random().toString(36).slice(2);
  return {
    accessToken: `mock.${user.id}.${nonce}`,
    refreshToken: `mockr.${user.id}.${nonce}`,
    tokenType: "Bearer",
    expiresIn: 900,
    user: identity(user),
  };
}

function userFromToken(token: string | undefined, prefix: string): Row | null {
  if (!token) return null;
  const [kind, id] = token.split(".");
  if (kind !== prefix) return null;
  const user = byId(db.users, id);
  return user && user.status === "active" ? user : null;
}

function identity(user: Row) {
  return { id: user.id, username: user.username, email: user.email, fullName: user.fullName };
}

// ---------------------------------------------------------------------------
// Response shapes — the join from stored rows to what the frontend reads
// ---------------------------------------------------------------------------

function userSummary(id: unknown) {
  const user = byId(db.users, id);
  return user ? { id: user.id, username: user.username, fullName: user.fullName } : null;
}

function orgSummary(id: unknown) {
  const org = byId(db.organizations, id);
  return org ? { id: org.id, code: org.code, name: org.name, status: org.status } : null;
}

function deptSummary(id: unknown) {
  const dep = byId(db.departments, id);
  return dep ? { id: dep.id, code: dep.code, name: dep.name } : null;
}

function roleSummary(id: unknown) {
  const role = byId(db.roles, id);
  return role ? { id: role.id, code: role.code, name: role.name } : null;
}

const present = {
  permissions: (p: Row) => ({ ...p }),
  roles: (r: Row) => {
    const { permissionIds, ...rest } = r;
    return {
      ...rest,
      permissions: (permissionIds as number[])
        .map((id) => byId(db.permissions, id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, code: p!.code, name: p!.name })),
    };
  },
  organizations: (o: Row) => ({ ...o }),
  departments: (d: Row) => {
    const { organizationId, ...rest } = d;
    return { ...rest, organization: orgSummary(organizationId) };
  },
  users: (u: Row) => {
    const { roleIds, organizationId, departmentId, ...rest } = u;
    delete rest.password;
    const org = orgSummary(organizationId);
    return {
      ...rest,
      roles: (roleIds as number[]).map(roleSummary).filter(Boolean),
      organization: org ? { id: org.id, code: org.code, name: org.name } : null,
      department: deptSummary(departmentId),
    };
  },
  categories: (c: Row) => ({ ...c }),
  blog_posts: (b: Row) => {
    const { categoryId, ...rest } = b;
    const category = byId(db.categories, categoryId);
    return { ...rest, category: category ? { id: category.id, title: category.title } : null };
  },
  tasks: (t: Row) => {
    const { assigneeId, departmentId, createdById, ...rest } = t;
    const overdue =
      t.dueDate !== null &&
      (t.dueDate as string) < today() &&
      t.status !== "done" &&
      t.status !== "cancelled";
    return {
      ...rest,
      assignee: userSummary(assigneeId),
      department: deptSummary(departmentId),
      createdBy: userSummary(createdById),
      overdue,
    };
  },
  notifications: (n: Row) => {
    const rest = { ...n };
    delete rest.recipientId;
    return rest;
  },
  row_level_policies: (p: Row) => {
    const { roleId, createdById, updatedById, ...rest } = p;
    return {
      ...rest,
      role: roleSummary(roleId),
      createdBy: userSummary(createdById),
      updatedBy: userSummary(updatedById),
    };
  },
  markets: (m: Row) => ({ ...m }),
} satisfies Record<string, (row: Row) => Json>;

type ResourceName = keyof typeof present;

// ---------------------------------------------------------------------------
// The list dialect
// ---------------------------------------------------------------------------

function matches(actual: unknown, op: string, expected: string): boolean {
  if (op === "like") {
    return actual !== null && actual !== undefined && String(actual).toLowerCase().includes(expected.toLowerCase());
  }
  if (actual === null || actual === undefined) return op === "ne";
  const a = String(actual);
  switch (op) {
    case "eq":
      return a.toLowerCase() === expected.toLowerCase();
    case "ne":
      return a.toLowerCase() !== expected.toLowerCase();
    case "gte":
    case "lte": {
      const numeric = typeof actual === "number" && !Number.isNaN(Number(expected));
      const cmp = numeric ? (actual as number) - Number(expected) : a.localeCompare(expected);
      return op === "gte" ? cmp >= 0 : cmp <= 0;
    }
  }
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

function listResponse(ctx: Context, rows: Json[]) {
  const q = ctx.query;

  const ids = [...q.entries()]
    .filter(([key]) => key === "ids" || key.startsWith("ids["))
    .map(([, value]) => Number(value));
  if (ids.length) {
    const found = rows.filter((row) => ids.includes(row.id as number));
    ctx.res.setHeader("X-Total-Count", String(found.length));
    return found;
  }

  let result = rows;

  for (const [key, value] of q.entries()) {
    if (key.startsWith("_") || key === "q" || value === "") continue;
    const match = key.match(/^(.*?)(_ne|_gte|_lte|_like)?$/)!;
    const field = match[1];
    const op = match[2]?.slice(1) ?? "eq";
    result = result.filter((row) => {
      const actual = getPath(row, field);
      // A filter on a collection (`roles.id`) matches when any element does.
      if (field.includes(".") && Array.isArray(getPath(row, field.split(".")[0]))) {
        const [head, ...tail] = field.split(".");
        return (getPath(row, head) as unknown[]).some((item) => matches(getPath(item, tail.join(".")), op, value));
      }
      return matches(actual, op, value);
    });
  }

  const term = q.get("q")?.trim().toLowerCase();
  if (term) {
    result = result.filter((row) =>
      Object.entries(row).some(([key, value]) => {
        if (key === "id") return String(value) === term;
        if (typeof value === "string") return value.toLowerCase().includes(term);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return Object.values(value).some((v) => typeof v === "string" && v.toLowerCase().includes(term));
        }
        return false;
      })
    );
  }

  const sort = q.get("_sort");
  if (sort) {
    const fields = sort.split(",");
    const orders = (q.get("_order") ?? "").split(",");
    result = [...result].sort((a, b) => {
      for (let i = 0; i < fields.length; i++) {
        const direction = orders[i] === "desc" ? -1 : 1;
        const cmp = compare(getPath(a, fields[i]), getPath(b, fields[i]));
        if (cmp !== 0) return cmp * direction;
      }
      return 0;
    });
  } else {
    result = [...result].sort((a, b) => (b.id as number) - (a.id as number));
  }

  ctx.res.setHeader("X-Total-Count", String(result.length));
  const start = Math.max(Number(q.get("_start") ?? 0), 0);
  const end = Number(q.get("_end") ?? start + 10);
  return result.slice(start, end);
}

// ---------------------------------------------------------------------------
// Writes, one per resource — validation, foreign keys, derived fields
// ---------------------------------------------------------------------------

type Writer = {
  table: Row[];
  /** Applies a create (`row` is a fresh object) or a patch. Throws to refuse. */
  apply: (row: Row, body: Json, creating: boolean, ctx: Context) => void;
  /** Throws a 409 when something still refers to the row. */
  beforeDelete?: (row: Row) => void;
  afterWrite?: (row: Row, before: Row | null, ctx: Context) => void;
};

function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

function unique(table: Row[], row: Row, test: (other: Row) => boolean, message: string) {
  if (table.some((other) => other.id !== row.id && test(other))) throw conflict(message);
}

const writers: Partial<Record<ResourceName, Writer>> = {
  categories: {
    table: db.categories,
    apply(row, body, creating) {
      required(body, { title: "Title is required" }, creating);
      assign(row, body, ["title"]);
    },
    beforeDelete(row) {
      if (db.blogPosts.some((p) => p.categoryId === row.id)) {
        throw conflict("This category is still referenced by other records");
      }
    },
  },

  blog_posts: {
    table: db.blogPosts,
    apply(row, body, creating) {
      required(body, { title: "Title is required", content: "Content is required" }, creating);
      assign(row, body, ["title", "content", "status"]);
      if (creating) {
        row.status ??= "draft";
        row.createdAt = now();
      }
      const categoryId = refId(body.category);
      if (categoryId !== undefined) {
        if (categoryId === null || !byId(db.categories, categoryId)) {
          throw invalid({ category: "Category is required" });
        }
        row.categoryId = categoryId;
      } else if (creating) {
        throw invalid({ category: "Category is required" });
      }
    },
  },

  organizations: {
    table: db.organizations,
    apply(row, body, creating) {
      required(body, { code: "Code is required", name: "Name is required" }, creating);
      assign(row, body, ["code", "name", "description", "email", "phone", "address", "status"]);
      unique(db.organizations, row, (o) => o.code === row.code, `An organization with code ${row.code} already exists`);
      if (creating) {
        row.status ??= "active";
        row.createdAt = now();
        row.updatedAt = null;
      } else {
        row.updatedAt = now();
      }
    },
    beforeDelete(row) {
      if (db.departments.some((d) => d.organizationId === row.id) || db.users.some((u) => u.organizationId === row.id)) {
        throw conflict("This organization is still referenced by other records");
      }
    },
  },

  departments: {
    table: db.departments,
    apply(row, body, creating) {
      required(body, { code: "Code is required", name: "Name is required" }, creating);
      const organizationId = refId(body.organization);
      if (organizationId !== undefined) {
        if (organizationId === null || !byId(db.organizations, organizationId)) {
          throw invalid({ organization: "Organization is required" });
        }
        if (!creating && organizationId !== row.organizationId && db.users.some((u) => u.departmentId === row.id)) {
          throw conflict("This department still has people in it; move them before changing its organization");
        }
      } else if (creating) {
        throw invalid({ organization: "Organization is required" });
      }
      const code = "code" in body ? str(body.code) : row.code;
      const orgId = organizationId ?? row.organizationId;
      unique(db.departments, row, (d) => d.organizationId === orgId && d.code === code,
        `${byId(db.organizations, orgId)?.name} already has a department with code ${code}`);
      assign(row, body, ["code", "name", "description", "email", "phone", "status"]);
      if (organizationId !== undefined) row.organizationId = organizationId;
      if (creating) {
        row.status ??= "active";
        row.createdAt = now();
        row.updatedAt = null;
      } else {
        row.updatedAt = now();
      }
    },
    beforeDelete(row) {
      if (db.users.some((u) => u.departmentId === row.id) || db.tasks.some((t) => t.departmentId === row.id)) {
        throw conflict("This department is still referenced by other records");
      }
    },
  },

  roles: {
    table: db.roles,
    apply(row, body, creating) {
      required(body, { code: "Code is required", name: "Name is required" }, creating);
      if ("code" in body && !/^[A-Z][A-Z0-9_]*$/.test(String(body.code))) {
        throw invalid({ code: "Code must be upper case letters, digits and underscores, starting with a letter" });
      }
      if (!creating && row.systemRole && "code" in body && body.code !== row.code) {
        throw conflict("The code of a system role cannot be changed");
      }
      assign(row, body, ["code", "name", "description"]);
      unique(db.roles, row, (r) => r.code === row.code, `A role with code ${row.code} already exists`);
      if (Array.isArray(body.permissions)) {
        row.permissionIds = body.permissions.map((p) => refId(p)).filter((id) => id && byId(db.permissions, id));
      } else if (creating) {
        throw invalid({ permissions: "Permissions are required" });
      }
      if (creating) row.systemRole = false;
    },
    beforeDelete(row) {
      if (row.systemRole) throw conflict("A system role cannot be deleted");
      if (db.users.some((u) => (u.roleIds as number[]).includes(row.id))) {
        throw conflict("This role is still referenced by other records");
      }
    },
  },

  users: {
    table: db.users,
    apply(row, body, creating) {
      required(body, { username: "Username is required", email: "Email is required", fullName: "Full name is required" }, creating);
      if (creating && String(body.password ?? "").length < 8) {
        throw invalid({ password: "Password must be between 8 and 100 characters" });
      }
      assign(row, body, ["username", "email", "fullName", "status"]);
      unique(db.users, row, (u) => u.username === row.username, `Username ${row.username} is already taken`);
      unique(db.users, row, (u) => u.email === row.email, `Email ${row.email} is already in use`);

      if (Array.isArray(body.roles)) {
        const ids = body.roles.map((r) => refId(r)).filter((id) => id && byId(db.roles, id)) as number[];
        if (!ids.length) throw invalid({ roles: "At least one role is required" });
        row.roleIds = ids;
      } else if (creating) {
        throw invalid({ roles: "At least one role is required" });
      }

      // Placement: absent leaves it alone, {id: null} clears it, and a
      // department with no organization beside it supplies its own.
      let organizationId = refId(body.organization);
      const departmentId = refId(body.department);
      if (organizationId === null) {
        row.organizationId = null;
        row.departmentId = null;
      }
      if (departmentId !== undefined && departmentId !== null) {
        const dep = byId(db.departments, departmentId);
        if (!dep) throw notFound("Department", departmentId);
        organizationId ??= dep.organizationId as number;
        if (organizationId !== dep.organizationId) {
          throw new HttpError(422, `${dep.name} does not belong to ${byId(db.organizations, organizationId)?.name}`);
        }
      }
      if (organizationId) {
        if (!byId(db.organizations, organizationId)) throw notFound("Organization", organizationId);
        if (organizationId !== row.organizationId && departmentId === undefined) row.departmentId = null;
        row.organizationId = organizationId;
      }
      if (departmentId !== undefined && organizationId !== null) row.departmentId = departmentId;

      if (creating) {
        row.password = body.password;
        row.status ??= "active";
        row.organizationId ??= null;
        row.departmentId ??= null;
        row.createdAt = now();
        row.updatedAt = null;
        row.lastLoginAt = null;
      } else {
        row.updatedAt = now();
      }
    },
    beforeDelete(row) {
      if (db.tasks.some((t) => t.assigneeId === row.id)) {
        throw conflict("This user is still referenced by other records");
      }
    },
  },

  tasks: {
    table: db.tasks,
    apply(row, body, creating, ctx) {
      required(body, { title: "Title is required" }, creating);
      const wasDone = row.status === "done";
      assign(row, body, ["title", "description", "status", "priority"]);
      if ("dueDate" in body) row.dueDate = str(body.dueDate);
      const assigneeId = refId(body.assignee);
      if (assigneeId !== undefined) {
        if (assigneeId !== null && !byId(db.users, assigneeId)) throw notFound("User", assigneeId);
        row.assigneeId = assigneeId;
      }
      const departmentId = refId(body.department);
      if (departmentId !== undefined) {
        if (departmentId !== null && !byId(db.departments, departmentId)) throw notFound("Department", departmentId);
        row.departmentId = departmentId;
      }
      if (creating) {
        row.status ??= "todo";
        row.priority ??= "medium";
        row.assigneeId ??= null;
        row.departmentId ??= null;
        row.dueDate ??= null;
        row.description ??= null;
        row.createdById = ctx.user?.id ?? null;
        row.createdAt = now();
        row.updatedAt = null;
      } else {
        row.updatedAt = now();
      }
      // Stamped on the transition into done, cleared on any move away.
      if (row.status === "done" && !wasDone) row.completedAt = now();
      if (row.status !== "done") row.completedAt = null;
    },
    afterWrite(row, before, ctx) {
      const assigneeId = row.assigneeId as number | null;
      if (assigneeId && assigneeId !== before?.assigneeId && assigneeId !== ctx.user?.id) {
        db.notifications.push({
          id: nextId(db.notifications),
          recipientId: assigneeId,
          level: "INFO",
          title: "You were assigned a task",
          body: row.title,
          link: `/tasks/show/${row.id}`,
          read: false,
          readAt: null,
          createdAt: now(),
        });
      }
    },
  },

  row_level_policies: {
    table: db.rowLevelPolicies,
    apply(row, body, creating, ctx) {
      if (creating) {
        required(body, { kind: "A kind is required", resource: "A resource is required", action: "An action is required", name: "A name is required" }, true);
        if (!body.scope || typeof body.scope !== "object") throw invalid({ scope: "A scope is required" });
        row.kind = body.kind;
        row.resource = body.resource;
      }
      assign(row, body, ["action", "name", "policyGroup", "description"]);
      if ("scope" in body) row.scope = body.scope;
      if ("checkScope" in body) row.checkScope = body.checkScope ?? null;
      if ("enabled" in body) row.enabled = Boolean(body.enabled);
      const roleId = refId(body.role);
      if (roleId !== undefined) row.roleId = roleId;
      if (row.kind === "SCOPE" && !row.roleId) throw new HttpError(422, "A SCOPE policy has to name a role");
      if (row.kind === "FILTER") row.roleId = null;
      if (creating) {
        row.enabled ??= true;
        row.checkScope ??= null;
        row.invalidReason = null;
        row.source = "runtime";
        row.createdById = ctx.user?.id ?? null;
        row.updatedById = null;
        row.createdAt = now();
        row.updatedAt = null;
      } else {
        row.updatedById = ctx.user?.id ?? null;
        row.updatedAt = now();
      }
    },
    afterWrite() {
      policyGeneration++;
    },
  },
};

const TABLES: Record<ResourceName, Row[]> = {
  permissions: db.permissions,
  roles: db.roles,
  organizations: db.organizations,
  departments: db.departments,
  users: db.users,
  categories: db.categories,
  blog_posts: db.blogPosts,
  tasks: db.tasks,
  notifications: db.notifications,
  row_level_policies: db.rowLevelPolicies,
  markets: db.markets,
};

// ---------------------------------------------------------------------------
// Row-level policy insights
// ---------------------------------------------------------------------------

const OPS = {
  long: ["eq", "ne", "in", "notIn"],
  enum: ["eq", "ne", "in", "notIn"],
  string: ["eq", "ne", "like", "notLike", "in", "notIn"],
  date: ["eq", "ne", "lt", "lte", "gt", "gte", "between"],
  datetime: ["lt", "lte", "gt", "gte", "between"],
} as const;

function field(path: string, type: keyof typeof OPS, nullable = false, values: string[] = []) {
  return {
    path,
    type,
    nullable,
    values,
    operators: [...OPS[type], ...(nullable ? ["isNull", "isNotNull"] : [])],
    warnNotNull: nullable,
  };
}

const MANAGED: Record<string, { defaultScope: "FULL" | "NONE"; fields: ReturnType<typeof field>[]; notCheckSafe: string[] }> = {
  tasks: {
    defaultScope: "FULL",
    fields: [
      field("id", "long"),
      field("status", "enum", false, ["todo", "in_progress", "blocked", "done", "cancelled"]),
      field("priority", "enum", false, ["low", "medium", "high", "urgent"]),
      field("dueDate", "date", true),
      field("completedAt", "datetime", true),
      field("createdAt", "datetime"),
      field("assignee.id", "long", true),
      field("department.id", "long", true),
      field("createdBy.id", "long", true),
    ],
    notCheckSafe: ["id", "createdAt", "updatedAt", "completedAt"],
  },
  blog_posts: {
    defaultScope: "FULL",
    fields: [
      field("id", "long"),
      field("status", "enum", false, ["draft", "published", "rejected"]),
      field("createdAt", "datetime"),
      field("category.id", "long"),
    ],
    notCheckSafe: ["id", "createdAt"],
  },
  categories: {
    defaultScope: "FULL",
    fields: [field("id", "long"), field("title", "string")],
    notCheckSafe: ["id"],
  },
  organizations: {
    defaultScope: "FULL",
    fields: [field("id", "long"), field("code", "string"), field("status", "enum", false, ["active", "inactive"])],
    notCheckSafe: ["id", "createdAt", "updatedAt"],
  },
  departments: {
    defaultScope: "FULL",
    fields: [
      field("id", "long"),
      field("code", "string"),
      field("status", "enum", false, ["active", "inactive"]),
      field("organization.id", "long"),
    ],
    notCheckSafe: ["id", "createdAt", "updatedAt"],
  },
};

const CONTEXT = [
  { key: "user.id", type: "long", collection: false },
  { key: "user.organizationId", type: "long", collection: false },
  { key: "user.departmentId", type: "long", collection: false },
  { key: "user.roleIds", type: "long", collection: true },
];

type Node = { all?: Node[]; any?: Node[]; not?: Node; field?: string; op?: string; value?: { lit?: unknown; ctx?: string } };

function render(node: Node | null): string {
  if (!node) return "TRUE";
  if (node.all) return node.all.length ? `(${node.all.map(render).join(" AND ")})` : "TRUE";
  if (node.any) return node.any.length ? `(${node.any.map(render).join(" OR ")})` : "FALSE";
  if (node.not) return `NOT ${render(node.not)}`;
  const value = node.value
    ? "ctx" in node.value
      ? `:${node.value.ctx}`
      : JSON.stringify(node.value.lit)
    : "";
  return `${node.field} ${node.op}${value ? ` ${value}` : ""}`;
}

function contextValue(user: Row, key: string): unknown {
  switch (key) {
    case "user.id": return user.id;
    case "user.organizationId": return user.organizationId;
    case "user.departmentId": return user.departmentId;
    case "user.roleIds": return user.roleIds;
  }
  return null;
}

type Tri = "TRUE" | "FALSE" | "UNKNOWN";

/** Three-valued, as SQL is: a null operand makes a comparison UNKNOWN. */
function evaluate(node: Node, record: Json, user: Row): Tri {
  if (node.all) {
    const results = node.all.map((n) => evaluate(n, record, user));
    return results.includes("FALSE") ? "FALSE" : results.includes("UNKNOWN") ? "UNKNOWN" : "TRUE";
  }
  if (node.any) {
    const results = node.any.map((n) => evaluate(n, record, user));
    return results.includes("TRUE") ? "TRUE" : results.includes("UNKNOWN") ? "UNKNOWN" : "FALSE";
  }
  if (node.not) {
    const inner = evaluate(node.not, record, user);
    return inner === "UNKNOWN" ? "UNKNOWN" : inner === "TRUE" ? "FALSE" : "TRUE";
  }
  const actual = getPath(record, node.field!);
  if (node.op === "isNull") return actual == null ? "TRUE" : "FALSE";
  if (node.op === "isNotNull") return actual == null ? "FALSE" : "TRUE";
  const operand = node.value && "ctx" in node.value ? contextValue(user, node.value.ctx!) : node.value?.lit;
  if (actual == null || operand == null) return "UNKNOWN";
  const list = Array.isArray(operand) ? operand : [operand];
  const result = (() => {
    switch (node.op) {
      case "eq": return String(actual) === String(operand);
      case "ne": return String(actual) !== String(operand);
      case "in": return list.map(String).includes(String(actual));
      case "notIn": return !list.map(String).includes(String(actual));
      case "like": return String(actual).toLowerCase().includes(String(operand).toLowerCase());
      case "notLike": return !String(actual).toLowerCase().includes(String(operand).toLowerCase());
      case "lt": return compare(actual, operand) < 0;
      case "lte": return compare(actual, operand) <= 0;
      case "gt": return compare(actual, operand) > 0;
      case "gte": return compare(actual, operand) >= 0;
      case "between": return compare(actual, list[0]) >= 0 && compare(actual, list[1]) <= 0;
    }
    return false;
  })();
  return result ? "TRUE" : "FALSE";
}

function policiesFor(resource: string, action: string) {
  return db.rowLevelPolicies.filter((p) => p.enabled && p.resource === resource && p.action === action);
}

function explain(user: Row, resource: string, action: string) {
  const meta = MANAGED[resource];
  if (!meta) throw new HttpError(422, `${resource} is not under row-level management`);
  const roleIds = new Set(user.roleIds as number[]);
  const policies = policiesFor(resource, action);
  const rule = (p: Row) => ({
    source: `runtime #${p.id}`,
    role: (byId(db.roles, p.roleId)?.code as string) ?? null,
    name: p.name,
    reads: render(p.scope as Node),
    checks: p.checkScope ? render(p.checkScope as Node) : null,
    applies: p.kind === "FILTER" || roleIds.has(p.roleId as number),
  });
  const scopes = policies.filter((p) => p.kind === "SCOPE").map(rule);
  const filters = policies.filter((p) => p.kind === "FILTER").map(rule);

  const warnings: string[] = [];
  const unscoped = rolesOf(user).filter((role) => !scopes.some((s) => s.role === role.code));
  if (meta.defaultScope === "FULL" && unscoped.length) {
    warnings.push(
      `${unscoped.map((r) => r.code).join(", ")} has no scope on ${resource}:${action}, so under FULL this account is unrestricted.`
    );
  }
  const applying = scopes.filter((s) => s.applies);
  const scopePart = unscoped.length && meta.defaultScope === "FULL"
    ? "TRUE"
    : applying.length ? applying.map((s) => s.reads).join(" OR ") : "FALSE";
  const filterPart = filters.map((f) => f.reads);

  return {
    principal: {
      userId: user.id,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      roleCodes: rolesOf(user).map((r) => r.code),
    },
    resource,
    action,
    defaultScope: meta.defaultScope,
    scopes,
    filters,
    effective: [scopePart, ...filterPart].map((part) => `(${part})`).join(" AND "),
    warnings,
  };
}

function simulate(body: Json) {
  const user = byId(db.users, body.userId);
  if (!user) throw notFound("User", body.userId);
  const resource = String(body.resource) as ResourceName;
  const stored = byId(TABLES[resource] ?? [], body.recordId);
  if (!stored) throw notFound("Record", body.recordId);
  const record = present[resource](stored);
  const roleIds = new Set(user.roleIds as number[]);
  const policies = policiesFor(resource, String(body.action));

  for (const filter of policies.filter((p) => p.kind === "FILTER")) {
    const result = evaluate(filter.scope as Node, record, user);
    if (result !== "TRUE") {
      return { allowed: false, evaluatedAs: result, failedAt: `filter "${filter.name}"`, because: render(filter.scope as Node) };
    }
  }

  const unscoped = rolesOf(user).some((role) => !policies.some((p) => p.kind === "SCOPE" && p.roleId === role.id));
  if (unscoped && MANAGED[resource]?.defaultScope === "FULL") {
    return { allowed: true, evaluatedAs: "TRUE", failedAt: null, because: "A role this account holds has no scope, and the resource defaults to FULL" };
  }

  let outcome: Tri = "FALSE";
  let last: Row | null = null;
  for (const scope of policies.filter((p) => p.kind === "SCOPE" && roleIds.has(p.roleId as number))) {
    const result = evaluate(scope.scope as Node, record, user);
    last = scope;
    if (result === "TRUE") return { allowed: true, evaluatedAs: "TRUE", failedAt: null, because: `scope "${scope.name}"` };
    if (result === "UNKNOWN") outcome = "UNKNOWN";
  }
  return {
    allowed: false,
    evaluatedAs: outcome,
    failedAt: last ? `scope "${last.name}"` : null,
    because: last ? render(last.scope as Node) : "No scope of this account's roles applies",
  };
}

function coverage() {
  return {
    resources: Object.entries(MANAGED).map(([resource, meta]) => ({
      resource,
      defaultScope: meta.defaultScope,
      cells: db.roles.flatMap((role) =>
        ["read", "write", "delete"].map((action) => {
          const hasScope = policiesFor(resource, action).some((p) => p.kind === "SCOPE" && p.roleId === role.id);
          return {
            role: role.code,
            action,
            hasScope,
            risk: hasScope ? "OK" : meta.defaultScope === "FULL" ? "UNRESTRICTED" : "CLOSED",
          };
        })
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const ACTION_BY_METHOD: Record<string, string> = {
  GET: "read",
  POST: "write",
  PUT: "write",
  PATCH: "write",
  DELETE: "delete",
};

function handleAuth(ctx: Context): unknown {
  const [, action] = ctx.segments;
  const { body } = ctx;

  if (action === "login" && ctx.method === "POST") {
    const login = String(body.username ?? "").trim();
    const user = db.users.find((u) => u.username === login || u.email === login);
    if (!user || user.password !== body.password || user.status !== "active") {
      throw new HttpError(401, "Incorrect username or password");
    }
    user.lastLoginAt = now();
    return issueTokens(user);
  }
  if (action === "refresh" && ctx.method === "POST") {
    const user = userFromToken(body.refreshToken as string, "mockr");
    if (!user) throw new HttpError(401, "Your session has ended. Sign in again.");
    return issueTokens(user);
  }
  if (action === "logout" && ctx.method === "POST") {
    return { success: true };
  }

  if (!ctx.user) throw new HttpError(401, "Authentication required");

  if (action === "me") return identity(ctx.user);
  if (action === "permissions") return authorities(ctx.user);
  if (action === "change-password" && ctx.method === "POST") {
    if (body.currentPassword !== ctx.user.password) {
      throw invalid({ currentPassword: "Current password is incorrect" });
    }
    if (String(body.newPassword ?? "").length < 8) {
      throw invalid({ newPassword: "New password must be between 8 and 100 characters" });
    }
    ctx.user.password = body.newPassword;
    return issueTokens(ctx.user);
  }
  throw new HttpError(404, "Not found");
}

function handleNotifications(ctx: Context): unknown {
  const user = ctx.user!;
  const [, idOrAction, sub] = ctx.segments;
  const mine = db.notifications.filter((n) => n.recipientId === user.id);
  const find = (id: string) => {
    const row = mine.find((n) => n.id === Number(id));
    if (!row) throw notFound("Notification", id);
    return row;
  };

  if (ctx.method === "GET") {
    requirePermission(ctx, "notifications:read");
    if (!idOrAction) return listResponse(ctx, mine.map(present.notifications));
    if (idOrAction === "recent") {
      return [...mine].sort((a, b) => compare(b.createdAt, a.createdAt)).slice(0, 20).map(present.notifications);
    }
    if (idOrAction === "unread-count") return { unread: mine.filter((n) => !n.read).length };
    return present.notifications(find(idOrAction));
  }
  if (ctx.method === "POST" && idOrAction === "read-all") {
    requirePermission(ctx, "notifications:read");
    for (const n of mine) if (!n.read) Object.assign(n, { read: true, readAt: now() });
    return { success: true };
  }
  if (ctx.method === "POST" && sub === "read") {
    requirePermission(ctx, "notifications:read");
    const row = find(idOrAction);
    if (!row.read) Object.assign(row, { read: true, readAt: now() });
    return present.notifications(row);
  }
  if (ctx.method === "POST" && !idOrAction) {
    // Raising one for somebody else is what this endpoint really does.
    requirePermission(ctx, "users:write");
    const recipient = byId(db.users, ctx.body.recipientId);
    if (!recipient) throw notFound("User", ctx.body.recipientId);
    const row: Row = {
      id: nextId(db.notifications),
      recipientId: recipient.id,
      level: ctx.body.level ?? "INFO",
      title: ctx.body.title,
      body: ctx.body.body ?? null,
      link: ctx.body.link ?? null,
      read: false,
      readAt: null,
      createdAt: now(),
    };
    db.notifications.push(row);
    return present.notifications(row);
  }
  if (ctx.method === "DELETE" && idOrAction) {
    requirePermission(ctx, "notifications:delete");
    const row = find(idOrAction);
    db.notifications.splice(db.notifications.indexOf(row), 1);
    return present.notifications(row);
  }
  throw new HttpError(404, "Not found");
}

function handleRowLevelExtras(ctx: Context): unknown | undefined {
  const [, action] = ctx.segments;
  const resource = String(ctx.query.get("resource") ?? ctx.body.resource ?? "");

  switch (action) {
    case "metadata": {
      requirePermission(ctx, "row_level_policies:read");
      const meta = MANAGED[resource];
      if (!meta) throw new HttpError(422, `${resource} is not under row-level management`);
      return {
        resource,
        defaultScope: meta.defaultScope,
        fields: meta.fields,
        context: CONTEXT,
        notCheckSafe: meta.notCheckSafe,
        designTime: [],
      };
    }
    case "coverage":
      requirePermission(ctx, "row_level_policies:read");
      return coverage();
    case "explain": {
      requirePermission(ctx, "row_level_policies:read");
      requirePermission(ctx, "users:read");
      const user = byId(db.users, ctx.query.get("userId"));
      if (!user) throw notFound("User", ctx.query.get("userId"));
      return explain(user, resource, String(ctx.query.get("action") ?? "read"));
    }
    case "simulate":
      requirePermission(ctx, "row_level_policies:read");
      requirePermission(ctx, "users:read");
      return simulate(ctx.body);
  }
  return undefined;
}

function handleResource(ctx: Context): unknown {
  const [name, id, sub] = ctx.segments;
  if (!(name in present)) throw new HttpError(404, `No resource called ${name}`);
  const resource = name as ResourceName;
  const table = TABLES[resource];

  // POST /users/{id}/password — an admin setting someone else's password.
  if (resource === "users" && sub === "password" && ctx.method === "POST") {
    requirePermission(ctx, "users:write");
    const user = byId(table, id);
    if (!user) throw notFound("User", id);
    if (String(ctx.body.password ?? "").length < 8) {
      throw invalid({ password: "Password must be between 8 and 100 characters" });
    }
    user.password = ctx.body.password;
    return present.users(user);
  }

  // GET /markets/{id}/layout — the market's buildings › floors › rows › points,
  // whole. Read-only and one request: a market is a few hundred points at most,
  // and every view of it (the stacking plan, the table, the totals) needs all of
  // them at once.
  if (resource === "markets" && sub === "layout" && ctx.method === "GET") {
    requirePermission(ctx, "markets:read");
    if (!byId(table, id)) throw notFound("markets", id);
    return { marketId: Number(id), buildings: premises[Number(id)] ?? [] };
  }

  requirePermission(ctx, `${resource}:${ACTION_BY_METHOD[ctx.method] ?? "read"}`);

  if (ctx.method === "GET") {
    if (!id) return listResponse(ctx, table.map(present[resource]));
    const row = byId(table, id);
    if (!row) throw notFound(resource, id);
    return present[resource](row);
  }

  const writer = writers[resource];
  if (!writer) throw new HttpError(405, `${resource} is read-only`);

  if (ctx.method === "POST" && !id) {
    const row: Row = { id: nextId(table) };
    writer.apply(row, ctx.body, true, ctx);
    table.push(row);
    writer.afterWrite?.(row, null, ctx);
    ctx.res.statusCode = 201;
    return present[resource](row);
  }

  const row = byId(table, id);
  if (!row) throw notFound(resource, id);

  if (ctx.method === "PATCH" || ctx.method === "PUT") {
    const before = structuredClone(row);
    const draft = structuredClone(row);
    writer.apply(draft, ctx.body, false, ctx);
    Object.assign(row, draft);
    writer.afterWrite?.(row, before, ctx);
    return present[resource](row);
  }

  if (ctx.method === "DELETE") {
    writer.beforeDelete?.(row);
    const response = present[resource](row);
    table.splice(table.indexOf(row), 1);
    if (resource === "row_level_policies") policyGeneration++;
    return response;
  }

  throw new HttpError(405, "Method not allowed");
}

function route(ctx: Context): unknown {
  const [head] = ctx.segments;
  if (head === "auth") return handleAuth(ctx);
  if (!ctx.user) throw new HttpError(401, "Authentication required");
  if (head === "notifications") return handleNotifications(ctx);
  if (head === "row_level_policies") {
    const extra = handleRowLevelExtras(ctx);
    if (extra !== undefined) return extra;
  }
  return handleResource(ctx);
}

async function readBody(req: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://mock");
  const ctx: Context = {
    method: (req.method ?? "GET").toUpperCase(),
    segments: url.pathname.split("/").filter(Boolean),
    query: url.searchParams,
    body: await readBody(req),
    user: userFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""), "mock"),
    res,
  };

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  let status = 200;
  let payload: unknown;
  try {
    payload = route(ctx);
    status = res.statusCode || 200;
  } catch (error) {
    if (error instanceof HttpError) {
      status = error.status;
      payload = { status: error.status, message: error.message, errors: error.errors };
    } else {
      console.error("[mock-api]", error);
      status = 500;
      payload = { status: 500, message: error instanceof Error ? error.message : "Mock API failure" };
    }
  }

  if (ctx.user) res.setHeader("X-Auth-Version", authVersion(ctx.user));
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload ?? {}));
}

/** Mounts the mock API on the dev server at {@link MOCK_API_PREFIX}. */
export function mockApi(): Plugin {
  return {
    name: "dth-mock-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(MOCK_API_PREFIX, (req, res) => {
        void handle(req, res);
      });
      server.config.logger.info(
        `  ➜  Mock API:  ${MOCK_API_PREFIX} (admin / Admin@123 · manager / Manager@123 · viewer / User@123)`
      );
    },
  };
}
