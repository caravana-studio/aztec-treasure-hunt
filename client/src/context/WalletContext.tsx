import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { EmbeddedWallet } from '../embedded-wallet';
import { TreasureHuntContract } from '../artifacts/TreasureHunt';

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
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [myAddress, setMyAddress] = useState<AztecAddress | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<AztecAddress | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const contractAddr = import.meta.env.VITE_CONTRACT_ADDRESS;
        const deployerAddress = import.meta.env.VITE_DEPLOYER_ADDRESS;
        const deploymentSalt = import.meta.env.VITE_DEPLOYMENT_SALT;
        const nodeUrl = import.meta.env.VITE_AZTEC_NODE_URL;

        if (!contractAddr) {
          throw new Error('Missing environment variables. Run yarn deploy-contracts first.');
        }

        const w = await EmbeddedWallet.initialize(nodeUrl);

        const instance = await getContractInstanceFromInstantiationParams(
          TreasureHuntContract.artifact,
          {
            deployer: AztecAddress.fromString(deployerAddress),
            salt: Fr.fromString(deploymentSalt),
            constructorArgs: [AztecAddress.fromString(deployerAddress)],
          }
        );
        await w.registerContract(instance, TreasureHuntContract.artifact);

        setWallet(w);
        setContractAddress(AztecAddress.fromString(contractAddr));

        const existingAccount = await w.connectExistingAccount();
        if (existingAccount) {
          setMyAddress(existingAccount);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize wallet');
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  const createAccount = useCallback(async () => {
    if (!wallet) return;
    setIsConnecting(true);
    setError(null);
    try {
      const account = await wallet.createAccountAndConnect();
      setMyAddress(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsConnecting(false);
    }
  }, [wallet]);

  const connectTestAccount = useCallback(async (index: number) => {
    if (!wallet) return;
    setIsConnecting(true);
    setError(null);
    try {
      const account = await wallet.connectTestAccount(index);
      setMyAddress(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect test account');
    } finally {
      setIsConnecting(false);
    }
  }, [wallet]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        myAddress,
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
