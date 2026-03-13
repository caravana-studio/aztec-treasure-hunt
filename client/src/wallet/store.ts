/**
 * Multi-wallet Zustand store
 *
 * Supports Embedded, MetaMask and Azguard wallet types. The `wallet` property
 * is always a BaseWallet-compatible object that can be passed to
 * TreasureHuntContract.at(address, wallet).
 */
import { create } from 'zustand';
import type { MultiWalletStore } from './types';
import { WalletType } from './types';
import { reconnectEmbedded, createEmbeddedAccount } from './connectors/EmbeddedConnector';
import { connectMetaMask } from './connectors/MetaMaskConnector';
import { connectAzguard } from './connectors/AzguardConnector';
import { getNetworkConfig } from '../config/network';

let cachedNodeUrl: string | null = null;

function getNodeUrl(): string {
  return cachedNodeUrl ?? getNetworkConfig().nodeUrl;
}

export const useMultiWalletStore = create<MultiWalletStore>((set, get) => ({
  // State
  wallet: null,
  address: null,
  contractAddress: null,
  walletType: null,
  status: 'disconnected',
  error: null,

  // Initialize: attempt to reconnect last session, then go to disconnected
  initialize: async (url: string) => {
    const { status } = get();
    if (status === 'initializing' || status === 'connected') return;

    cachedNodeUrl = url;
    set({ status: 'initializing', error: null });

    try {
      const lastType = localStorage.getItem('aztec-wallet-type') as WalletType | null;

      if (lastType === WalletType.EMBEDDED) {
        try {
          const result = await reconnectEmbedded(url);
          if (result) {
            set({
              wallet: result.wallet,
              address: result.address,
              contractAddress: result.contractAddress,
              walletType: WalletType.EMBEDDED,
              status: 'connected',
              error: null,
            });
            return;
          }
        } catch {
          // Reconnection failed — fall through to disconnected
        }
      }
      // No saved wallet or reconnection failed
      set({ status: 'disconnected' });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Initialization failed',
      });
    }
  },

  connectEmbedded: async () => {
    if (get().status === 'connecting') return;
    set({ status: 'connecting', error: null });
    try {
      const result = await createEmbeddedAccount(getNodeUrl());
      localStorage.setItem('aztec-wallet-type', WalletType.EMBEDDED);
      set({
        wallet: result.wallet,
        address: result.address,
        contractAddress: result.contractAddress,
        walletType: WalletType.EMBEDDED,
        status: 'connected',
        error: null,
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to create embedded account',
      });
    }
  },

  connectMetaMask: async () => {
    if (get().status === 'connecting') return;
    set({ status: 'connecting', error: null });
    try {
      const result = await connectMetaMask(getNodeUrl());
      localStorage.setItem('aztec-wallet-type', WalletType.METAMASK);
      set({
        wallet: result.wallet,
        address: result.address,
        contractAddress: result.contractAddress,
        walletType: WalletType.METAMASK,
        status: 'connected',
        error: null,
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to connect MetaMask',
      });
    }
  },

  connectAzguard: async () => {
    if (get().status === 'connecting') return;
    set({ status: 'connecting', error: null });
    try {
      const result = await connectAzguard(getNodeUrl());
      localStorage.setItem('aztec-wallet-type', WalletType.AZGUARD);
      set({
        wallet: result.wallet,
        address: result.address,
        contractAddress: result.contractAddress,
        walletType: WalletType.AZGUARD,
        status: 'connected',
        error: null,
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to connect Azguard',
      });
    }
  },

  disconnect: () => {
    localStorage.removeItem('aztec-wallet-type');
    set({
      wallet: null,
      address: null,
      contractAddress: null,
      walletType: null,
      status: 'disconnected',
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
