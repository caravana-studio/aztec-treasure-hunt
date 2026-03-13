import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';

export enum WalletType {
  EMBEDDED = 'embedded',
  METAMASK = 'metamask',
  AZGUARD = 'azguard',
}

export type MultiWalletStatus =
  | 'disconnected'
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'error';

export interface MultiWalletState {
  wallet: BaseWallet | null;
  address: AztecAddress | null;
  contractAddress: AztecAddress | null;
  walletType: WalletType | null;
  status: MultiWalletStatus;
  error: string | null;
}

export interface MultiWalletActions {
  initialize: (nodeUrl: string) => Promise<void>;
  connectEmbedded: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  connectAzguard: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

export type MultiWalletStore = MultiWalletState & MultiWalletActions;
