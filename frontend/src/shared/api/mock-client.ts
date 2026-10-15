import { handleMockFetch } from "../../../mock/api";
import { API_URL, MOCK_API } from "./constants";

let initialized = false;

/**
 * Initializes the in-browser mock API interceptor.
 *
 * Catches fetch requests destined for the mock API (e.g. on Vercel deployment where
 * Vite dev server does not exist) and serves responses directly in the browser.
 */
export function initMockApi() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;

    const isMock =
      urlString.includes("/mock-api") ||
      (MOCK_API && (urlString.startsWith(API_URL) || urlString.includes("localhost:8080"))) ||
      urlString.includes("/markets");

    if (isMock) {
      try {
        const request =
          input instanceof Request && !init
            ? input
            : new Request(input, init);

        return await handleMockFetch(request);
      } catch (err) {
        console.error("[mock-client] Mock handler error:", err);
      }
    }

    return originalFetch(input, init);
  };
}
