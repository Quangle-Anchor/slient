import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

import { mockApi } from "./mock/api";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `npm run dev` runs in the `mock` mode (`.env.mock`), which serves the API
  // from `mock/` inside this dev server so the UI runs with no backend at all.
  // `npm run dev:api` is the plain mode, talking to the Spring Boot app.
  const useMock = loadEnv(mode, process.cwd(), "VITE_").VITE_MOCK_API === "true";

  return {
    plugins: [react(), tailwindcss(), ...(useMock ? [mockApi()] : [])],
    // The backend only allows CORS from :5173 (app.cors.allowed-origins). Without
    // strictPort, a second dev server silently falls back to :5174 and every API
    // call dies on a 403 preflight instead of failing loudly here.
    server: {
      port: 5176,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
