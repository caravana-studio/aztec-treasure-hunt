import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import type { WalletType } from '../wallet/types';

export type WalletStatus = 'disconnected' | 'initializing' | 'connecting' | 'connected';

export interface WalletState {
  wallet: BaseWallet | null;
  address: AztecAddress | null;
  contractAddress: AztecAddress | null;
  walletType: WalletType | null;
  status: WalletStatus;
  error: string | null;
}

export interface WalletActions {
  initialize: (nodeUrl: string) => Promise<void>;
  connectEmbedded: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  startAzguardDiscovery: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

export type WalletStore = WalletState & WalletActions;
