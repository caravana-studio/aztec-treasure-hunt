import { create } from 'zustand';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { EmbeddedWallet } from '../../embedded-wallet';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { getNetworkConfig } from '../../config/network';
import type { WalletStore, WalletStatus } from '../../types/wallet';

export const useWalletStore = create<WalletStore>((set, get) => ({
  // State
  wallet: null,
  address: null,
  contractAddress: null,
  status: 'disconnected' as WalletStatus,
  error: null,

  // Actions
  initialize: async (nodeUrl: string) => {
    const { status } = get();
    if (status === 'initializing' || status === 'connected') {
      return;
    }

    set({ status: 'initializing', error: null });

    try {
      const config = getNetworkConfig();
      const wallet = await EmbeddedWallet.initialize(nodeUrl);

      // Register TreasureHunt contract
      const instance = await getContractInstanceFromInstantiationParams(
        TreasureHuntContract.artifact,
        {
          deployer: AztecAddress.fromString(config.deployerAddress),
          salt: Fr.fromString(config.deploymentSalt),
          constructorArgs: [AztecAddress.fromString(config.deployerAddress)],
        }
      );
      await wallet.registerContract(instance, TreasureHuntContract.artifact);

      const contractAddress = AztecAddress.fromString(config.contractAddress);

      // Try to connect existing account
      const existingAccount = await wallet.connectExistingAccount();

      set({
        wallet,
        contractAddress,
        address: existingAccount,
        status: existingAccount ? 'connected' : 'disconnected',
      });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to initialize wallet',
      });
    }
  },

  createAccount: async () => {
    const { wallet, status } = get();
    if (!wallet || status === 'connecting') {
      return;
    }

    set({ status: 'connecting', error: null });

    try {
      const address = await wallet.createAccountAndConnect();
      set({ address, status: 'connected' });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to create account',
      });
    }
  },

  connectTestAccount: async (index: number) => {
    const { wallet, status } = get();
    if (!wallet || status === 'connecting') {
      return;
    }

    set({ status: 'connecting', error: null });

    try {
      const address = await wallet.connectTestAccount(index);
      set({ address, status: 'connected' });
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Failed to connect test account',
      });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      wallet: null,
      address: null,
      contractAddress: null,
      status: 'disconnected',
      error: null,
    });
  },
}));

// Selector hooks for better performance
export const useWallet = () => useWalletStore((state) => state.wallet);
export const useWalletAddress = () => useWalletStore((state) => state.address);
export const useContractAddress = () => useWalletStore((state) => state.contractAddress);
export const useWalletStatus = () => useWalletStore((state) => state.status);
export const useWalletError = () => useWalletStore((state) => state.error);
export const useWalletActions = () =>
  useWalletStore((state) => ({
    initialize: state.initialize,
    createAccount: state.createAccount,
    connectTestAccount: state.connectTestAccount,
    setError: state.setError,
    clearError: state.clearError,
    reset: state.reset,
  }));
