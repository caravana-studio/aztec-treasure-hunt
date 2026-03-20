/**
 * Multi-wallet Zustand store
 *
 * Supports Embedded and Azguard wallet types. The `wallet` property
 * is always a BaseWallet-compatible object that can be passed to
 * TreasureHuntContract.at(address, wallet).
 */
import { create } from 'zustand';
import type { MultiWalletStore, AzguardDiscoveryState } from './types';
import { WalletType } from './types';
import { reconnectEmbedded, createEmbeddedAccount } from './connectors/EmbeddedConnector';
import {
  discoverWallets,
  establishChannel,
  getVerificationEmojis,
  confirmConnection,
} from './connectors/AzguardConnector';
import { getNetworkConfig } from '../config/network';

let cachedNodeUrl: string | null = null;

function getNodeUrl(): string {
  return cachedNodeUrl ?? getNetworkConfig().nodeUrl;
}

const INITIAL_AZGUARD: AzguardDiscoveryState = {
  session: null,
  providers: [],
  pending: null,
  verificationEmojis: [],
};

export const useMultiWalletStore = create<MultiWalletStore>((set, get) => ({
  // State
  wallet: null,
  address: null,
  contractAddress: null,
  walletType: null,
  status: 'disconnected',
  error: null,
  azguard: { ...INITIAL_AZGUARD },

  // Initialize: attempt to reconnect last session, then go to disconnected
  initialize: async (url: string) => {
    const { status } = get();
    if (status === 'initializing' || status === 'connected') return;

    cachedNodeUrl = url;
    set({ status: 'initializing', error: null });

    try {
      const lastType = localStorage.getItem('aztec-wallet-type') as WalletType | null;

      // Azguard cannot auto-reconnect — the secure channel is ephemeral
      if (lastType === WalletType.AZGUARD) {
        localStorage.removeItem('aztec-wallet-type');
        set({ status: 'disconnected' });
        return;
      }

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

  startAzguardDiscovery: async () => {
    const { status } = get();
    if (status === 'discovering' || status === 'connecting') return;
    set({
      status: 'discovering',
      error: null,
      azguard: { ...INITIAL_AZGUARD },
    });
    try {
      const session = await discoverWallets(getNodeUrl(), (provider) => {
        set((state) => {
          const existing = state.azguard.providers;
          if (existing.some((p) => p.id === provider.id)) return state;
          return {
            azguard: {
              ...state.azguard,
              providers: [...existing, provider],
            },
          };
        });
      });
      set((state) => ({
        azguard: { ...state.azguard, session },
      }));
      // Wait for discovery to complete (timeout)
      await session.done;
    } catch (err) {
      // Only set error if we're still in discovering state (not cancelled)
      if (get().status === 'discovering') {
        set({
          status: 'disconnected',
          error: err instanceof Error ? err.message : 'Discovery failed',
          azguard: { ...INITIAL_AZGUARD },
        });
      }
    }
  },

  selectAzguardProvider: async (provider) => {
    const { azguard } = get();
    // Cancel ongoing discovery
    azguard.session?.cancel();
    set({ status: 'connecting', error: null });
    try {
      const pending = await establishChannel(provider);
      const emojis = getVerificationEmojis(pending);
      set({
        status: 'verifying',
        azguard: {
          ...get().azguard,
          pending,
          verificationEmojis: emojis,
        },
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to establish secure channel',
        azguard: { ...INITIAL_AZGUARD },
      });
    }
  },

  confirmAzguardConnection: async () => {
    const { azguard } = get();
    if (!azguard.pending || get().status !== 'verifying') return;
    set({ status: 'connecting', error: null });
    try {
      const result = await confirmConnection(azguard.pending);
      localStorage.setItem('aztec-wallet-type', WalletType.AZGUARD);
      set({
        wallet: result.wallet,
        address: result.address,
        contractAddress: result.contractAddress,
        walletType: WalletType.AZGUARD,
        status: 'connected',
        error: null,
        azguard: { ...INITIAL_AZGUARD },
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to confirm connection',
        azguard: { ...INITIAL_AZGUARD },
      });
    }
  },

  cancelAzguardConnection: () => {
    const { azguard } = get();
    azguard.session?.cancel();
    azguard.pending?.cancel();
    set({
      status: 'disconnected',
      error: null,
      azguard: { ...INITIAL_AZGUARD },
    });
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
      azguard: { ...INITIAL_AZGUARD },
    });
  },

  clearError: () => set({ error: null }),
}));
