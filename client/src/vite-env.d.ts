/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    azguard?: unknown;
  }
}

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_DEPLOYER_ADDRESS: string;
  readonly VITE_ADMIN_ADDRESS?: string;
  readonly VITE_DEPLOYMENT_SALT: string;
  readonly VITE_AZTEC_NODE_URL: string;
  readonly VITE_PROVER_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
