/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. See `src/shared/api/constants.ts`. */
  readonly VITE_API_URL?: string;
  /** "true" under `npm run dev` (`.env.mock`): serve the API from `mock/`. */
  readonly VITE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
