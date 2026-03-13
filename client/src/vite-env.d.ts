/// <reference types="vite/client" />

export {};

// EIP-1193 provider (window.ethereum — MetaMask etc.)
interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
    azguard?: unknown;
  }
}

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_DEPLOYER_ADDRESS: string;
  readonly VITE_DEPLOYMENT_SALT: string;
  readonly VITE_AZTEC_NODE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
