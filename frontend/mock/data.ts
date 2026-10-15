/**
 * Seed data for the mock API — the same rows the backend's Liquibase seeds
 * create, plus enough extra accounts and tasks to fill a few pages.
 *
 * Rows are stored the way the database stores them (foreign keys as ids); the
 * handlers in `api.ts` join them into the response shapes the frontend reads.
 * Everything lives in memory and resets when the dev server restarts.
 */

export type Row = { id: number; [key: string]: unknown };

function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function dateIn(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function numbered<T extends object>(rows: T[]): (T & { id: number })[] {
  return rows.map((row, index) => ({ id: index + 1, ...row }));
}

// ---------------------------------------------------------------------------
// Permissions and roles
// ---------------------------------------------------------------------------

const PERMISSION_SEED: [string, string, string][] = [
  ["users:read", "View users", "List and open user accounts"],
  ["users:write", "Create and edit users", "Create accounts, edit them, assign roles and reset passwords"],
  ["users:delete", "Delete users", "Permanently remove a user account"],
  ["roles:read", "View roles", "List and open roles and the permissions they grant"],
  ["roles:write", "Create and edit roles", "Create roles and change the permissions they grant"],
  ["roles:delete", "Delete roles", "Permanently remove a role"],
  ["permissions:read", "View permissions", "Read the permission catalogue"],
  ["blog_posts:read", "View blog posts", "List and open blog posts"],
  ["blog_posts:write", "Edit blog posts", "Create and edit blog posts"],
  ["blog_posts:delete", "Delete blog posts", "Permanently remove a blog post"],
  ["categories:read", "View categories", "List and open categories"],
  ["categories:write", "Edit categories", "Create and edit categories"],
  ["categories:delete", "Delete categories", "Permanently remove a category"],
  ["notifications:read", "View notifications", "See your own notifications and mark them read"],
  ["notifications:delete", "Delete notifications", "Permanently remove one of your own notifications"],
  ["organizations:read", "View organizations", "List and open organizations"],
  ["organizations:write", "Create and edit organizations", "Create organizations and edit their details"],
  ["organizations:delete", "Delete organizations", "Permanently remove an organization"],
  ["departments:read", "View departments", "List and open departments"],
  ["departments:write", "Create and edit departments", "Create departments and edit their details"],
  ["departments:delete", "Delete departments", "Permanently remove a department"],
  ["tasks:read", "View tasks", "List and open tasks"],
  ["tasks:write", "Create and edit tasks", "Raise tasks, assign them and move them"],
  ["tasks:delete", "Delete tasks", "Permanently remove a task"],
  ["row_level_policies:read", "View data scopes", "See which rows each role may reach"],
  ["row_level_policies:write", "Edit data scopes", "Narrow or widen a role's data scope"],
  ["row_level_policies:delete", "Delete data scopes", "Remove a data scope policy"],
  ["markets:read", "View markets", "List the markets and see them on the map"],
  ["markets:write", "Edit markets", "Add markets and correct their details and position"],
  ["markets:delete", "Delete markets", "Permanently remove a market"],
];

const permissions = numbered(
  PERMISSION_SEED.map(([code, name, description]) => ({
    code,
    name,
    description,
    systemPermission: true,
  }))
);

function permissionIds(codes: string[]): number[] {
  return permissions.filter((p) => codes.includes(p.code)).map((p) => p.id);
}

const roles = numbered([
  {
    code: "ADMIN",
    name: "Administrator",
    description: "Full access to every part of the system, including users and roles.",
    systemRole: true,
    permissionIds: permissions.map((p) => p.id),
  },
  {
    code: "MANAGER",
    name: "Manager",
    description: "Manages all content and can see, but not change, users and roles.",
    systemRole: true,
    permissionIds: permissionIds([
      "users:read", "roles:read", "permissions:read",
      "blog_posts:read", "blog_posts:write", "blog_posts:delete",
      "categories:read", "categories:write", "categories:delete",
      "notifications:read", "notifications:delete",
      "organizations:read",
      "departments:read", "departments:write", "departments:delete",
      "tasks:read", "tasks:write", "tasks:delete",
      "markets:read", "markets:write",
    ]),
  },
  {
    code: "USER",
    name: "User",
    description: "Read-only access to content.",
    systemRole: true,
    permissionIds: permissionIds([
      "blog_posts:read", "categories:read",
      "notifications:read", "notifications:delete",
      "organizations:read", "departments:read",
      "tasks:read", "tasks:write",
      "markets:read",
    ]),
  },
]);

// ---------------------------------------------------------------------------
// Organizations and departments
// ---------------------------------------------------------------------------

const organizations = numbered([
  { code: "DTH", name: "DTH Group", description: "The parent company.", email: "contact@dth.local", phone: "+84 24 3900 0001", address: "15 Nguyen Trai, Hanoi", status: "active", createdAt: daysAgo(1000), updatedAt: null },
  { code: "DTHS", name: "DTH Software", description: "Product engineering subsidiary.", email: "software@dth.local", phone: "+84 24 3900 0002", address: "22 Le Duan, Hanoi", status: "active", createdAt: daysAgo(980), updatedAt: null },
  { code: "DTHC", name: "DTH Consulting", description: "Advisory and delivery services.", email: "consult@dth.local", phone: "+84 28 3800 0003", address: "9 Ton Duc Thang, Da Nang", status: "active", createdAt: daysAgo(930), updatedAt: null },
  { code: "DTHL", name: "DTH Labs", description: "Retired research arm, folded into DTH Software.", email: null, phone: null, address: null, status: "inactive", createdAt: daysAgo(1200), updatedAt: null },
]);

const ORG = Object.fromEntries(organizations.map((o) => [o.code, o.id]));

const departments = numbered([
  { code: "EXEC", name: "Executive Office", description: "Board and company officers.", organizationId: ORG.DTH, email: "exec@dth.local", phone: "+84 24 3900 0010", status: "active", createdAt: daysAgo(1000), updatedAt: null },
  { code: "FIN", name: "Finance", description: "Accounting, payroll and procurement.", organizationId: ORG.DTH, email: "finance@dth.local", phone: "+84 24 3900 0011", status: "active", createdAt: daysAgo(999), updatedAt: null },
  { code: "HR", name: "People Operations", description: "Hiring, onboarding and employee records.", organizationId: ORG.DTH, email: "people@dth.local", phone: "+84 24 3900 0012", status: "active", createdAt: daysAgo(999), updatedAt: null },
  { code: "ENG", name: "Engineering", description: "Platform, product and infrastructure teams.", organizationId: ORG.DTHS, email: "eng@dth.local", phone: "+84 24 3900 0020", status: "active", createdAt: daysAgo(975), updatedAt: null },
  { code: "QA", name: "Quality Assurance", description: "Test engineering and release verification.", organizationId: ORG.DTHS, email: "qa@dth.local", phone: "+84 24 3900 0021", status: "active", createdAt: daysAgo(975), updatedAt: null },
  { code: "DESIGN", name: "Design", description: "Product design and the design system.", organizationId: ORG.DTHS, email: "design@dth.local", phone: null, status: "active", createdAt: daysAgo(960), updatedAt: null },
  { code: "ENG", name: "Delivery Engineering", description: "Client-facing delivery teams.", organizationId: ORG.DTHC, email: "delivery@dth.local", phone: "+84 28 3800 0030", status: "active", createdAt: daysAgo(925), updatedAt: null },
  { code: "SALES", name: "Sales", description: "New business and account management.", organizationId: ORG.DTHC, email: "sales@dth.local", phone: "+84 28 3800 0031", status: "active", createdAt: daysAgo(925), updatedAt: null },
  { code: "RND", name: "Research", description: "Disbanded when DTH Labs closed.", organizationId: ORG.DTHL, email: null, phone: null, status: "inactive", createdAt: daysAgo(1200), updatedAt: null },
]);

function dept(orgCode: string, code: string): number {
  return departments.find((d) => d.organizationId === ORG[orgCode] && d.code === code)!.id;
}

// ---------------------------------------------------------------------------
// Users — the three seeded development accounts, then a few more for paging
// ---------------------------------------------------------------------------

const ROLE = Object.fromEntries(roles.map((r) => [r.code, r.id]));

type UserSeed = [username: string, fullName: string, password: string, role: string, org: string | null, dept: string | null, status?: string];

const USER_SEED: UserSeed[] = [
  ["admin", "System Administrator", "Admin@123", "ADMIN", "DTH", "EXEC"],
  ["manager", "Content Manager", "Manager@123", "MANAGER", "DTHS", "ENG"],
  ["viewer", "Read-only Viewer", "User@123", "USER", "DTHC", null],
  ["nguyen.van.an", "Nguyễn Văn An", "User@123", "USER", "DTH", "FIN"],
  ["tran.thi.binh", "Trần Thị Bình", "User@123", "USER", "DTH", "HR"],
  ["le.hoang.cuong", "Lê Hoàng Cường", "User@123", "MANAGER", "DTHS", "QA"],
  ["pham.minh.duc", "Phạm Minh Đức", "User@123", "USER", "DTHS", "ENG"],
  ["hoang.thu.ha", "Hoàng Thu Hà", "User@123", "USER", "DTHS", "DESIGN"],
  ["vu.quoc.huy", "Vũ Quốc Huy", "User@123", "USER", "DTHS", "ENG"],
  ["dang.thanh.lam", "Đặng Thanh Lâm", "User@123", "USER", "DTHC", "ENG"],
  ["bui.ngoc.mai", "Bùi Ngọc Mai", "User@123", "USER", "DTHC", "SALES"],
  ["do.van.nam", "Đỗ Văn Nam", "User@123", "USER", "DTHC", "SALES", "inactive"],
  ["ngo.phuong.oanh", "Ngô Phương Oanh", "User@123", "USER", "DTH", "FIN"],
  ["duong.tuan.phong", "Dương Tuấn Phong", "User@123", "USER", "DTHS", "QA", "locked"],
  ["ly.kim.quyen", "Lý Kim Quyên", "User@123", "USER", null, null],
];

const users = numbered(
  USER_SEED.map(([username, fullName, password, role, org, dep, status], index) => ({
    username,
    email: `${username}@dth.local`,
    fullName,
    password,
    status: status ?? "active",
    roleIds: [ROLE[role]],
    organizationId: org ? ORG[org] : null,
    departmentId: org && dep ? dept(org, dep) : null,
    createdAt: index < 3 ? daysAgo(1000) : daysAgo(300 - index * 15),
    updatedAt: null,
    lastLoginAt: index % 3 === 0 ? daysAgo(index, 8) : null,
  }))
);

const USER = Object.fromEntries(users.map((u) => [u.username, u.id]));

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const CATEGORY_TITLES = ["Architecture", "Frontend", "Backend", "DevOps", "Design System", "Security", "Performance", "Testing"];

const categories = numbered(CATEGORY_TITLES.map((title) => ({ title })));

const CAT = Object.fromEntries(categories.map((c) => [c.title, c.id]));

const POST_SEED: [title: string, content: string, status: string, category: string, ageDays: number][] = [
  ["Resources and routes are two halves of one declaration", "Refine infers the current resource from the URL, which is what lets useTable, useForm and the *Button components work without being told which resource they operate on.", "published", "Architecture", 900],
  ["Why the dialog is the route, not a piece of list state", "Nesting create, edit and show under the list route keeps the list mounted, so filters, sorting and pagination survive while the outlet renders the open dialog.", "published", "Architecture", 860],
  ["A first pass at modular monolith boundaries", "Package-by-feature keeps the seams visible without paying the operational cost of separate deployables.", "draft", "Architecture", 400],
  ["Column resizing that remembers what a default width meant", "Resizing is opt-in per column. A double-click on the divider goes back to the column default.", "published", "Frontend", 780],
  ["Debouncing the quick filter without dropping the last keystroke", "Writing through the table column filters rather than the core keeps a single source of truth.", "published", "Frontend", 700],
  ["Submitting a form from outside the form element", "When the submit button lives in a dialog footer it sits outside the form. The HTML form attribute wires it back.", "published", "Frontend", 500],
  ["Notes on migrating the table to React 19", "Mostly uneventful. The ref-as-a-prop change removed a forwardRef layer from every wrapper.", "draft", "Frontend", 250],
  ["Server components: an evaluation that went nowhere", "The admin shell is client-state heavy end to end. Rejected.", "rejected", "Frontend", 330],
  ["Speaking a REST dialect you did not design", "The data provider is the contract. It sends a start and end offset for the window, a sort field with an order, and a field with an operator suffix for each filter.", "published", "Backend", 760],
  ["Specifications beat a dozen optional query parameters", "Parsing the query string once and composing predicates keeps the controller down to a single request-parameter map.", "published", "Backend", 720],
  ["Every error response needs a body", "The client parses the response body on every non-2xx. An empty error payload surfaces as an unparseable response.", "published", "Backend", 460],
  ["One command to bring the whole stack up", "A dev environment nobody can start is a dev environment nobody uses.", "published", "DevOps", 670],
  ["Blue-green for a single-instance service", "Rejected on cost. Revisit when the service has more than one consumer.", "rejected", "DevOps", 270],
  ["No component holds a colour of its own", "Raw values live in one stylesheet, every semantic token derives from them, and components only ever reference the semantic name.", "published", "Design System", 990],
  ["Density as a single scaled unit", "Rescaling the base spacing unit tightens or loosens the entire shell without a single per-component override.", "published", "Design System", 700],
  ["Draft: a chart ramp that survives a brand hue change", "Rotating the ramp off the brand hue keeps the series distinguishable, but the fourth and fifth steps collide at low chroma.", "draft", "Design System", 120],
  ["Exposing a header the browser would otherwise hide", "A custom response header is invisible to fetch unless CORS names it explicitly.", "published", "Security", 720],
  ["Allow-listing sort properties", "A sort property goes straight into a query. Whitelisting the ones the UI offers turns a 500 into an ignored parameter.", "published", "Security", 480],
  ["Indexing for the queries the UI actually issues", "Default sort, category filter, status filter. Three indexes, chosen by reading the list view.", "published", "Performance", 310],
  ["There is no frontend test runner installed", "Stating it plainly, because the absence of a test script reads as an oversight rather than a decision.", "published", "Testing", 660],
  ["Draft: contract tests against the data provider dialect", "The query-string format is an implicit contract between two repositories.", "draft", "Testing", 60],
];

const blogPosts = numbered(
  POST_SEED.map(([title, content, status, category, age]) => ({
    title,
    content,
    status,
    categoryId: CAT[category],
    createdAt: daysAgo(age, 10),
  }))
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

type TaskSeed = [title: string, description: string, status: string, priority: string, assignee: string | null, org: string, dep: string, dueIn: number | null, age: number];

const TASK_SEED: TaskSeed[] = [
  ["Draft the Q3 engineering roadmap", "Collect input from each squad lead and publish a single plan.", "in_progress", "high", "manager", "DTHS", "ENG", 7, 9],
  ["Review the access control audit", "Walk the seeded roles against the permission catalogue.", "todo", "urgent", "admin", "DTH", "EXEC", -3, 14],
  ["Migrate the staging database", "Run the outstanding Liquibase changesets against staging.", "blocked", "high", "manager", "DTHS", "ENG", -1, 11],
  ["Write onboarding notes for new hires", "One page covering the local setup and the seeded accounts.", "todo", "low", null, "DTH", "HR", 21, 4],
  ["Close the Q2 books", "Reconcile the ledger and hand the summary to the auditors.", "done", "medium", "admin", "DTH", "FIN", -10, 30],
  ["Refresh the design system tokens", "Align the chart ramp with the new brand palette.", "todo", "medium", null, "DTHS", "DESIGN", 30, 2],
  ["Prepare the client renewal pack", "Pull usage figures and last year's terms for the renewal meeting.", "in_progress", "high", "viewer", "DTHC", "SALES", 4, 6],
  ["Retire the legacy reporting job", "Superseded by the new dashboard; confirm nothing still reads it.", "cancelled", "low", null, "DTHS", "ENG", null, 45],
  ["Run the payroll dry run", "Check the October figures before the bank cut-off.", "todo", "high", "nguyen.van.an", "DTH", "FIN", 2, 3],
  ["Update the employee handbook", "Add the remote-work policy approved last month.", "in_progress", "medium", "tran.thi.binh", "DTH", "HR", 12, 8],
  ["Regression pass for release 2.4", "Full manual pass on the admin screens before the tag.", "todo", "urgent", "le.hoang.cuong", "DTHS", "QA", 1, 2],
  ["Fix flaky login test", "Intermittent timeout on the refresh-token rotation case.", "blocked", "medium", "duong.tuan.phong", "DTHS", "QA", -5, 20],
  ["Design the market stall map screen", "Wireframes for the stall layout and occupancy view.", "in_progress", "high", "hoang.thu.ha", "DTHS", "DESIGN", 10, 7],
  ["Add CSV export to the users list", "Export the visible columns, then all rows with filters applied.", "done", "low", "pham.minh.duc", "DTHS", "ENG", -2, 25],
  ["Upgrade the Gradle wrapper", "Move to the latest wrapper and re-run the build cache numbers.", "todo", "low", "vu.quoc.huy", "DTHS", "ENG", 40, 1],
  ["Set up the client staging tenant", "Provision a tenant for the pilot market and seed it.", "in_progress", "urgent", "dang.thanh.lam", "DTHC", "ENG", 3, 5],
  ["Quarterly pipeline review", "Go through every open opportunity with the account owners.", "todo", "medium", "bui.ngoc.mai", "DTHC", "SALES", 6, 2],
  ["Collect vendor invoices for September", "Chase the three missing invoices before month-end close.", "done", "medium", "ngo.phuong.oanh", "DTH", "FIN", -15, 35],
  ["Archive the research wiki", "Export the old research pages before the space is deleted.", "cancelled", "low", null, "DTH", "EXEC", null, 90],
  ["Plan the year-end party", "Venue shortlist and budget by the end of the month.", "todo", "low", "tran.thi.binh", "DTH", "HR", 25, 1],
  ["Penetration test follow-ups", "Fix the two medium findings from the external test.", "in_progress", "urgent", "pham.minh.duc", "DTHS", "ENG", -1, 15],
  ["Translate the admin screens", "First pass of the Vietnamese strings for the shell and the lists.", "todo", "medium", "hoang.thu.ha", "DTHS", "DESIGN", 14, 3],
];

const tasks = numbered(
  TASK_SEED.map(([title, description, status, priority, assignee, org, dep, dueIn, age]) => ({
    title,
    description,
    status,
    priority,
    assigneeId: assignee ? USER[assignee] : null,
    departmentId: dept(org, dep),
    dueDate: dueIn === null ? null : dateIn(dueIn),
    completedAt: status === "done" ? daysAgo(2, 15) : null,
    createdById: USER.admin,
    createdAt: daysAgo(age, 9),
    updatedAt: age < 10 ? daysAgo(Math.max(age - 1, 0), 14) : null,
  }))
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const NOTIFICATION_SEED: [recipient: string, level: string, title: string, body: string | null, link: string | null, read: boolean, ageHours: number][] = [
  ["admin", "INFO", "Welcome to the mock API", "Everything you see is served by the Vite dev server. Changes reset when it restarts.", null, false, 1],
  ["admin", "WARNING", "Task overdue: Review the access control audit", "The due date passed three days ago.", "/tasks/show/2", false, 5],
  ["admin", "SUCCESS", "Q2 books closed", "Finance marked the task done.", "/tasks/show/5", true, 50],
  ["admin", "ERROR", "Staging migration blocked", "Changeset 017 failed against staging.", "/tasks/show/3", false, 26],
  ["admin", "INFO", "New account created", "Lý Kim Quyên was added without a placement.", "/users/show/15", true, 80],
  ["manager", "INFO", "You were assigned a task", "Draft the Q3 engineering roadmap", "/tasks/show/1", false, 3],
  ["manager", "WARNING", "Task blocked: Migrate the staging database", null, "/tasks/show/3", false, 20],
  ["viewer", "INFO", "You were assigned a task", "Prepare the client renewal pack", "/tasks/show/7", false, 6],
];

const notifications = numbered(
  NOTIFICATION_SEED.map(([recipient, level, title, body, link, read, ageHours]) => {
    const createdAt = new Date(Date.now() - ageHours * 3_600_000).toISOString();
    return {
      recipientId: USER[recipient],
      level,
      title,
      body,
      link,
      read,
      readAt: read ? createdAt : null,
      createdAt,
    };
  })
);

// ---------------------------------------------------------------------------
// Row-level policies — a few examples so the screens have something to show
// ---------------------------------------------------------------------------

const rowLevelPolicies = numbered([
  {
    kind: "SCOPE",
    roleId: ROLE.MANAGER,
    resource: "tasks",
    action: "read",
    name: "Tasks in my department",
    policyGroup: "ownership",
    description: "A manager sees the work of their own department.",
    scope: { field: "department.id", op: "eq", value: { ctx: "user.departmentId" } },
    checkScope: null,
    enabled: true,
    invalidReason: null,
    source: "runtime",
    createdById: USER.admin,
    updatedById: null,
    createdAt: daysAgo(40),
    updatedAt: null,
  },
  {
    kind: "SCOPE",
    roleId: ROLE.USER,
    resource: "tasks",
    action: "read",
    name: "My own tasks",
    policyGroup: "ownership",
    description: "Tasks assigned to me or raised by me.",
    scope: {
      any: [
        { field: "assignee.id", op: "eq", value: { ctx: "user.id" } },
        { field: "createdBy.id", op: "eq", value: { ctx: "user.id" } },
      ],
    },
    checkScope: null,
    enabled: true,
    invalidReason: null,
    source: "runtime",
    createdById: USER.admin,
    updatedById: null,
    createdAt: daysAgo(40),
    updatedAt: null,
  },
  {
    kind: "SCOPE",
    roleId: ROLE.USER,
    resource: "tasks",
    action: "write",
    name: "Edit my open tasks",
    policyGroup: "workflow",
    description: "Open tasks assigned to me; the saved record only has to stay mine.",
    scope: {
      all: [
        { field: "assignee.id", op: "eq", value: { ctx: "user.id" } },
        { field: "status", op: "in", value: { lit: ["todo", "in_progress", "blocked"] } },
      ],
    },
    checkScope: { field: "assignee.id", op: "eq", value: { ctx: "user.id" } },
    enabled: true,
    invalidReason: null,
    source: "runtime",
    createdById: USER.admin,
    updatedById: USER.admin,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(12),
  },
  {
    kind: "FILTER",
    roleId: null,
    resource: "blog_posts",
    action: "delete",
    name: "Published posts are never deleted",
    policyGroup: null,
    description: "Unpublish first; a published post is a public record.",
    scope: { not: { field: "status", op: "eq", value: { lit: "published" } } },
    checkScope: null,
    enabled: true,
    invalidReason: null,
    source: "runtime",
    createdById: USER.admin,
    updatedById: null,
    createdAt: daysAgo(20),
    updatedAt: null,
  },
  {
    kind: "SCOPE",
    roleId: ROLE.MANAGER,
    resource: "departments",
    action: "write",
    name: "Departments of my organization",
    policyGroup: null,
    description: "Disabled while the organization reference is being renamed.",
    scope: { field: "organization.id", op: "eq", value: { ctx: "user.organizationId" } },
    checkScope: null,
    enabled: false,
    invalidReason: null,
    source: "runtime",
    createdById: USER.admin,
    updatedById: null,
    createdAt: daysAgo(10),
    updatedAt: null,
  },
]);

// ---------------------------------------------------------------------------
// Markets — the twelve the application manages, in the order they were handed
// over. Positions:
//   surveyed     the market's own point or outline on OpenStreetMap
//   approximate  only the place is known: Tân Việt Hòa sits on the OSM point of
//                that name, Tân Thuận Đông beside the former commune's People's
//                Committee, Hòa An and Tịnh Thới at the centre of the pre-2025
//                commune they are named after
//   unknown      nothing found; listed, not pinned (Thông Lưu is in the former
//                Hòa An commune, Long Hồi could not be placed at all)
// Addresses follow the post-2025 form (street, then "phường Cao Lãnh, tỉnh
// Đồng Tháp"), with the pre-2025 unit in brackets because that is still how
// people find their way. The street is the named road nearest the market's
// point on OpenStreetMap (Tân Thuận Tây's comes from its own addr:* tags);
// a market placed only from its commune gets the commune, not a guessed
// street. Chợ Mỹ Ngãi sits on the old ward line, so it names no old unit.
// None of these has been confirmed against the management board's records.
// ---------------------------------------------------------------------------

type MarketSeed = [name: string, lat: number | null, lon: number | null, precision: string, ward: string | null, address: string | null];

const NEW_WARD = "phường Cao Lãnh, tỉnh Đồng Tháp";

const MARKET_SEED: MarketSeed[] = [
  ["Chợ Cao Lãnh", 10.4541, 105.6368, "surveyed", "Phường Cao Lãnh", `Đường Nguyễn Đình Chiểu (Phường 1 cũ), ${NEW_WARD}`],
  ["Chợ Hòa An", 10.4546, 105.60858, "approximate", "Phường Cao Lãnh", `Xã Hòa An cũ, ${NEW_WARD}`],
  ["Chợ Tân Việt Hòa", 10.428746, 105.635671, "approximate", "Phường Cao Lãnh", `Khu vực Tân Việt Hòa (Phường 6 cũ), ${NEW_WARD}`],
  ["Chợ Tân Thuận Tây", 10.465056, 105.587841, "surveyed", "Phường Cao Lãnh", `Xã Tân Thuận Tây cũ, ${NEW_WARD}`],
  ["Chợ Thông Lưu", null, null, "unknown", "Phường Cao Lãnh", `Xã Hòa An cũ, ${NEW_WARD}`],
  ["Chợ Tân Tịch", 10.417638, 105.644782, "surveyed", "Phường Cao Lãnh", `Đường Nguyễn Hương (Phường 6 cũ), ${NEW_WARD}`],
  ["Chợ Tịnh Thới", 10.42656, 105.66853, "approximate", "Phường Cao Lãnh", `Xã Tịnh Thới cũ, ${NEW_WARD}`],
  ["Chợ Mỹ Ngãi", 10.469518, 105.6244, "surveyed", "Phường Cao Lãnh", `Đường 30 Tháng 4, ${NEW_WARD}`],
  ["Chợ Tân Thuận Đông", 10.431603, 105.606005, "approximate", "Phường Cao Lãnh", `Gần UBND xã Tân Thuận Đông cũ, ${NEW_WARD}`],
  ["Chợ Long Hồi", null, null, "unknown", null, null],
  ["Chợ Xẻo Bèo (CDC)", 10.460541, 105.60878, "surveyed", "Phường Cao Lãnh", `Đường Đỗ Văn Y (Xã Hòa An cũ), ${NEW_WARD}`],
  ["Chợ Sáu Quốc", 10.475181, 105.600755, "surveyed", "Phường Cao Lãnh", `Khu vực Sáu Quốc (Xã Hòa An cũ), ${NEW_WARD}`],
];

const markets = numbered(
  MARKET_SEED.map(([name, latitude, longitude, locationPrecision, ward, address], index) => ({
    code: `CL${String(index + 1).padStart(2, "0")}`,
    name,
    ward,
    address,
    latitude,
    longitude,
    locationPrecision,
    status: "active",
    createdAt: daysAgo(30),
    updatedAt: null,
  }))
);

// ---------------------------------------------------------------------------
// Premises — inside each market: buildings (toà), their floors, the rows (dãy)
// on each floor, and the business points (điểm kinh doanh) along each row, one
// tenant to a point. Nobody was handed the markets' drawings, so none of this
// says where anything physically is: only what contains what, in code order.
//
// Generated rather than written out — a few thousand points — from a seeded
// generator, so every restart produces the same markets. Dates are relative to
// today so that "expiring soon" always has something in it.
// ---------------------------------------------------------------------------

/** mulberry32: small, fast, and the same sequence for the same seed. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

const FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Võ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý", "Phan", "Trương", "Châu"];
const MIDDLE = ["Văn", "Thị", "Thị", "Minh", "Thanh", "Ngọc", "Hoàng", "Kim", "Hữu"];
const GIVEN = ["An", "Bình", "Cúc", "Dung", "Hạnh", "Hoa", "Hùng", "Lan", "Liên", "Lộc", "Mai", "Nam", "Nga", "Phúc", "Phượng", "Sang", "Tài", "Thảo", "Thu", "Trinh", "Tuấn", "Vân", "Xuân", "Yến", "Đức", "Kiệt"];

/** Fresh food on the ground floor, dry goods above it — how markets here are laid out. */
const FRESH_TRADES = ["Thịt heo", "Thịt bò", "Gia cầm", "Thủy hải sản", "Rau củ", "Trái cây", "Hàng ăn uống", "Hoa tươi"];
const DRY_TRADES = ["Tạp hóa", "Gia vị, hàng khô", "Quần áo", "Vải, may mặc", "Giày dép", "Mỹ phẩm", "Đồ gia dụng", "Vàng bạc", "Đồ điện"];

type BuildingSpec = [code: string, name: string, floors: number];

/**
 * Chợ Cao Lãnh is the provincial market and gets three buildings; the rest are
 * commune markets with one or two. Anything not listed is generated.
 */
const BUILDING_SPECS: Record<string, BuildingSpec[]> = {
  CL01: [["A", "Nhà lồng A", 3], ["B", "Nhà lồng B", 2], ["C", "Khu chợ cá", 1]],
  CL11: [["A", "Nhà lồng chính", 2], ["B", "Dãy ki-ốt mặt tiền", 1]],
};

function buildPremises() {
  const ids = { building: 0, floor: 0, row: 0, stall: 0 };
  const byMarket: Record<number, unknown[]> = {};

  for (const market of markets) {
    const rand = prng(market.id * 7919);
    const specs: BuildingSpec[] =
      BUILDING_SPECS[market.code] ??
      (rand.chance(0.45)
        ? [["A", "Nhà lồng chính", rand.int(1, 2)], ["B", "Khu ngoài trời", 1]]
        : [["A", "Nhà lồng chính", rand.int(1, 2)]]);

    byMarket[market.id] = specs.map(([code, name, floorCount]) => ({
      id: ++ids.building,
      code,
      name,
      floors: Array.from({ length: floorCount }, (_, f) => {
        const level = f + 1;
        const ground = level === 1;
        const rowCount = market.code === "CL01" ? rand.int(4, 6) : rand.int(2, 4);
        return {
          id: ++ids.floor,
          level,
          name: ground ? "Tầng 1 (trệt)" : `Tầng ${level}`,
          rows: Array.from({ length: rowCount }, (_, r) => {
            const rowCode = `${code}${level}-${String(r + 1).padStart(2, "0")}`;
            const trade = rand.pick(ground ? FRESH_TRADES : DRY_TRADES);
            const rate = ground ? 120_000 : 85_000;
            const stallCount = rand.int(market.code === "CL01" ? 8 : 5, market.code === "CL01" ? 16 : 11);
            return {
              id: ++ids.row,
              code: rowCode,
              name: `Dãy ${rowCode}`,
              stalls: Array.from({ length: stallCount }, (_, s) => {
                const area = rand.int(8, 24) / 2;
                const monthlyFee = Math.round((area * rate) / 10_000) * 10_000;
                const roll = rand.next();
                const status = roll < 0.13 ? "vacant" : roll < 0.16 ? "suspended" : "leased";
                const leased = status === "leased";
                // Mostly the row's own trade; now and then a neighbour sells something else.
                const tradeType = leased ? (rand.chance(0.85) ? trade : rand.pick(ground ? FRESH_TRADES : DRY_TRADES)) : null;
                const endIn = rand.chance(0.14) ? rand.int(3, 60) : rand.int(90, 900);
                const startAgo = rand.int(60, 1500);
                const stallCode = `${rowCode}-${String(s + 1).padStart(2, "0")}`;
                return {
                  id: ++ids.stall,
                  code: stallCode,
                  area,
                  tradeType,
                  status,
                  monthlyFee,
                  debt: leased && rand.chance(0.1) ? monthlyFee * rand.int(1, 3) : 0,
                  tenant: leased
                    ? {
                        name: `${rand.pick(FAMILY)} ${rand.pick(MIDDLE)} ${rand.pick(GIVEN)}`,
                        phone: `09${rand.int(10_000_000, 99_999_999)}`,
                      }
                    : null,
                  contract: leased
                    ? {
                        number: `HĐ-${market.code}-${String(ids.stall).padStart(5, "0")}`,
                        startDate: dateIn(-startAgo),
                        endDate: dateIn(endIn),
                      }
                    : null,
                  note: status === "suspended" ? "Tạm ngưng cho thuê — đang sửa chữa" : null,
                };
              }),
            };
          }),
        };
      }),
    }));
  }
  return byMarket;
}

const premises = buildPremises();

export function createDatabase() {
  // Deep-copied so a restart of the middleware (not of the process) starts clean.
  return structuredClone({
    permissions,
    roles,
    organizations,
    departments,
    users,
    categories,
    blogPosts,
    tasks,
    notifications,
    rowLevelPolicies,
    markets,
  }) as Record<
    | "permissions"
    | "roles"
    | "organizations"
    | "departments"
    | "users"
    | "categories"
    | "blogPosts"
    | "tasks"
    | "notifications"
    | "rowLevelPolicies"
    | "markets",
    Row[]
  >;
}

/** Each market's buildings, floors, rows and points, keyed by market id. */
export function createPremises(): Record<number, unknown[]> {
  return structuredClone(premises);
}
