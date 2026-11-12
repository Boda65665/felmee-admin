/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** База REST API Felmee, напр. https://felmee.com или http://localhost:8080 */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
