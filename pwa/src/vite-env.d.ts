/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_ORIGIN?: string;
  readonly VITE_BIO_BRIDGE_PACKAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
