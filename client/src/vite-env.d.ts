/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_DEPLOYER_ADDRESS: string;
  readonly VITE_DEPLOYMENT_SALT: string;
  readonly VITE_AZTEC_NODE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
