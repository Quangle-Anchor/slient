import type { AuthProvider } from "@refinedev/core";

import type { Identity } from "@/shared/api/session";

/**
 * Bypassed auth provider — always authenticated as admin.
 *
 * No API calls are made. The session is seeded with a hardcoded admin identity
 * and full permissions so the app renders the dashboard immediately.
 */

const ADMIN_IDENTITY: Identity = {
  id: 1,
  username: "admin",
  email: "admin@dth.local",
  fullName: "System Administrator",
};

/** Every permission the system defines, so the full menu is visible. */
const ALL_PERMISSIONS = [
  "blog_posts:delete", "blog_posts:read", "blog_posts:write",
  "categories:delete", "categories:read", "categories:write",
  "departments:delete", "departments:read", "departments:write",
  "markets:delete", "markets:read", "markets:write",
  "notifications:delete", "notifications:read",
  "organizations:delete", "organizations:read", "organizations:write",
  "permissions:read",
  "roles:delete", "roles:read", "roles:write",
  "row_level_policies:delete", "row_level_policies:read", "row_level_policies:write",
  "tasks:delete", "tasks:read", "tasks:write",
  "users:delete", "users:read", "users:write",
];

/**
 * Seed localStorage so the access-control provider and data provider hooks
 * can still read the cached authorities they expect.
 */
function ensureSession() {
  try {
    if (!localStorage.getItem("dth-auth-access-token")) {
      localStorage.setItem("dth-auth-access-token", "mock.1.bypass");
      localStorage.setItem("dth-auth-refresh-token", "mockr.1.bypass");
      localStorage.setItem("dth-auth-identity", JSON.stringify(ADMIN_IDENTITY));
      localStorage.setItem(
        "dth-auth-authorities",
        JSON.stringify({
          roles: ["ADMIN"],
          permissions: ALL_PERMISSIONS,
          version: "bypass.1",
          scopedResources: [],
        }),
      );
      localStorage.setItem("dth-auth-version", "bypass.1");
    }
  } catch {
    // Safari private browsing or blocked storage — the app will still render.
  }
}

// Seed immediately on module load so it's available before the first check().
ensureSession();

export const authProvider: AuthProvider = {
  async login() {
    return { success: true, redirectTo: "/" };
  },

  async logout() {
    return { success: true, redirectTo: "/" };
  },

  async check() {
    ensureSession();
    return { authenticated: true };
  },

  async onError() {
    return {};
  },

  async getIdentity(): Promise<Identity | null> {
    return ADMIN_IDENTITY;
  },

  async getPermissions(): Promise<string[]> {
    return ALL_PERMISSIONS;
  },
};
