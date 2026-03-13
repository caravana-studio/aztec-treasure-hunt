/**
 * ConnectModal — wallet selector using the game's glass morphism CSS.
 *
 * Shows 3 wallet options:
 *   1. Embedded Wallet (keys in localStorage, no extension required)
 *   2. MetaMask / EVM Wallet (signs with MetaMask, keys derived from signature)
 *   3. Azguard (browser extension wallet with its own PXE)
 */
import { useState } from 'react';
import { useMultiWalletStore } from './store';
import { isAzguardInstalled } from './connectors/AzguardConnector';

interface WalletOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  action: () => Promise<void>;
  available: boolean;
  unavailableReason?: string;
}

export function ConnectModal() {
  const { connectEmbedded, connectMetaMask, connectAzguard, status, error, clearError } =
    useMultiWalletStore();
  const [connecting, setConnecting] = useState<string | null>(null);

  const hasMetaMask =
    typeof window !== 'undefined' && !!window.ethereum;
  const hasAzguard = isAzguardInstalled();

  const walletOptions: WalletOption[] = [
    {
      id: 'embedded',
      name: 'Embedded Wallet',
      description: 'Instant play — account created automatically in your browser',
      icon: '🔑',
      action: connectEmbedded,
      available: true,
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Use your MetaMask wallet to derive an Aztec account',
      icon: '🦊',
      action: connectMetaMask,
      available: hasMetaMask,
      unavailableReason: 'MetaMask not detected. Install it and refresh.',
    },
    {
      id: 'azguard',
      name: 'Azguard',
      description: 'Use the Azguard Aztec browser wallet extension',
      icon: '🛡️',
      action: connectAzguard,
      available: hasAzguard,
      unavailableReason: 'Azguard not detected. Install the extension and refresh.',
    },
  ];

  const handleConnect = async (option: WalletOption) => {
    if (!option.available || connecting) return;
    clearError();
    setConnecting(option.id);
    try {
      await option.action();
    } finally {
      setConnecting(null);
    }
  };

  const isConnecting = status === 'connecting' || connecting !== null;

  return (
    <div className="lobby-form" style={{ gap: '12px' }}>
      <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', textAlign: 'center' }}>
        Choose how to connect to Aztec Network
      </p>

      {error && (
        <div className="error-toast" style={{ marginBottom: '8px' }} onClick={clearError}>
          {error}
        </div>
      )}

      {walletOptions.map((option) => (
        <button
          key={option.id}
          className={option.available ? 'glass-btn lobby-btn-full' : 'glass-btn-secondary lobby-btn-full'}
          onClick={() => handleConnect(option)}
          disabled={isConnecting || !option.available}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            textAlign: 'left',
            opacity: option.available ? 1 : 0.5,
            cursor: option.available ? 'pointer' : 'not-allowed',
          }}
        >
          <span style={{ fontSize: '24px', flexShrink: 0 }}>{option.icon}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              {connecting === option.id ? `Connecting ${option.name}...` : option.name}
            </span>
            <span style={{ fontSize: '12px', opacity: 0.75 }}>
              {option.available ? option.description : option.unavailableReason}
            </span>
          </span>
          {connecting === option.id && (
            <div className="loading-spinner" style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          )}
        </button>
      ))}
    </div>
  );
}
