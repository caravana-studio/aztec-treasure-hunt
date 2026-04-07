/**
 * WalletContext — thin bridge from multi-wallet store to the app's useWallet() hook.
 *
 * The game components call useWallet() and get:
 *   - wallet          : BaseWallet-compatible object
 *   - myAddress       : AztecAddress of the connected account
 *   - isInitializing  : true while PXE is starting
 *   - isConnecting    : true while connecting a wallet
 *   - error           : error string or null
 *   - contractAddress : deployed TreasureHunt contract address
 *   - clearError()
 *
 * The multi-wallet store (client/src/wallet/store.ts) owns the actual state.
 */
import { createContext, useContext, useEffect, ReactNode } from 'react';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { BaseWallet } from '@aztec/wallet-sdk/base-wallet';
import { useMultiWalletStore } from '../wallet/store';
import { getNetworkConfig } from '../config/network';
import { isUnsupportedMobileDevice } from '../utils/device';

interface WalletContextType {
  wallet: BaseWallet | null;
  myAddress: AztecAddress | null;
  isInitializing: boolean;
  isConnecting: boolean;
  error: string | null;
  contractAddress: AztecAddress | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { wallet, address, contractAddress, status, error, initialize, clearError } =
    useMultiWalletStore();

  useEffect(() => {
    if (isUnsupportedMobileDevice()) {
      return;
    }

    try {
      const config = getNetworkConfig();
      initialize(config.nodeUrl);
    } catch (err) {
      // .env not configured yet — stay disconnected
      console.warn('Network config not available:', err);
    }
  }, [initialize]);

  const isInitializing = status === 'initializing';
  const isConnecting = status === 'connecting';

  return (
    <WalletContext.Provider
      value={{
        wallet,
        myAddress: address,
        isInitializing,
        isConnecting,
        error,
        contractAddress,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
