/**
 * Base URL of the REST API backing every resource.
 *
 * <p>Read from `VITE_API_URL` so a deployment can repoint it without a code
 * change; the fallback is the `backend/` Spring Boot app in this repo running
 * with its default port and context path. `.env` is gitignored, so the fallback
 * — not the env file — is what a fresh checkout gets.
 */
/**
 * True under `npm run dev`, which serves a mock of the API from `mock/` inside
 * the Vite dev server (see `vite.config.ts`). `npm run dev:api` turns it off.
 */
export const MOCK_API: boolean =
  import.meta.env.VITE_MOCK_API === "true" ||
  (!import.meta.env.VITE_API_URL && (import.meta.env.PROD || import.meta.env.MODE === "mock"));

/**
 * Absolute even for the mock, because `live.ts` builds the socket URL from it
 * with `new URL`, which refuses a bare path.
 */
export const API_URL: string = MOCK_API
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/mock-api`
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api");
