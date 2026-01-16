import { AztecAddress } from '@aztec/aztec.js/addresses';
import { EmbeddedWallet } from '../embedded-wallet';

export type WalletStatus = 'disconnected' | 'initializing' | 'connecting' | 'connected';

export interface WalletState {
  wallet: EmbeddedWallet | null;
  address: AztecAddress | null;
  contractAddress: AztecAddress | null;
  status: WalletStatus;
  error: string | null;
}

export interface WalletActions {
  initialize: (nodeUrl: string) => Promise<void>;
  createAccount: () => Promise<void>;
  connectTestAccount: (index: number) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export type WalletStore = WalletState & WalletActions;
