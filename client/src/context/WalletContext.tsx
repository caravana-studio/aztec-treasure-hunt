import { createContext, useContext, useEffect, ReactNode } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { EmbeddedWallet } from '../embedded-wallet';
import { useWalletStore } from '../store/wallet';
import { getNetworkConfig } from '../config/network';

interface WalletContextType {
  wallet: EmbeddedWallet | null;
  myAddress: AztecAddress | null;
  isInitializing: boolean;
  isConnecting: boolean;
  error: string | null;
  contractAddress: AztecAddress | null;
  createAccount: () => Promise<void>;
  connectTestAccount: (index: number) => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const {
    wallet,
    address,
    contractAddress,
    status,
    error,
    initialize,
    createAccount,
    connectTestAccount,
    clearError,
  } = useWalletStore();

  // Initialize wallet on mount
  useEffect(() => {
    const config = getNetworkConfig();
    initialize(config.nodeUrl);
  }, [initialize]);

  // Map Zustand state to legacy context API
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
        createAccount,
        connectTestAccount,
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
