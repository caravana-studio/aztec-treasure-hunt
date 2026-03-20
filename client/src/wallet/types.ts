import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import type {
  DiscoverySession,
  WalletProvider,
  PendingConnection,
} from '@aztec/wallet-sdk/manager';

export enum WalletType {
  EMBEDDED = 'embedded',
  AZGUARD = 'azguard',
}

export type MultiWalletStatus =
  | 'disconnected'
  | 'initializing'
  | 'connecting'
  | 'discovering'
  | 'verifying'
  | 'connected'
  | 'error';

export interface AzguardDiscoveryState {
  session: DiscoverySession | null;
  providers: WalletProvider[];
  pending: PendingConnection | null;
  verificationEmojis: string[];
}

export interface MultiWalletState {
  wallet: BaseWallet | null;
  address: AztecAddress | null;
  contractAddress: AztecAddress | null;
  walletType: WalletType | null;
  status: MultiWalletStatus;
  error: string | null;
  azguard: AzguardDiscoveryState;
}

export interface MultiWalletActions {
  initialize: (nodeUrl: string) => Promise<void>;
  connectEmbedded: () => Promise<void>;
  startAzguardDiscovery: () => Promise<void>;
  selectAzguardProvider: (provider: WalletProvider) => Promise<void>;
  confirmAzguardConnection: () => Promise<void>;
  cancelAzguardConnection: () => void;
  disconnect: () => void;
  clearError: () => void;
}

export type MultiWalletStore = MultiWalletState & MultiWalletActions;
