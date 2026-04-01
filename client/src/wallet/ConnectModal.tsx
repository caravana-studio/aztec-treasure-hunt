/**
 * ConnectModal — wallet selector using the game's glass morphism CSS.
 *
 * Shows 2 wallet options:
 *   1. Embedded Wallet (keys in localStorage, no extension required)
 *   2. Azguard (browser extension wallet via Wallet SDK discovery + emoji verification)
 */
import { useState, useEffect } from 'react';
import { useMultiWalletStore } from './store';
import { isAzguardInstalled } from './connectors/AzguardConnector';
import type { WalletProvider } from './connectors/AzguardConnector';

type ModalView = 'select' | 'azguard-discovery' | 'azguard-verify';

interface WalletOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  action: () => void;
  available: boolean;
  unavailableReason?: string;
}

function canRenderProviderIcon(icon: string | undefined): boolean {
  if (!icon) {
    return false;
  }

  return /^(https?:|data:|blob:)/.test(icon);
}

export function ConnectModal() {
  const {
    connectEmbedded,
    startAzguardDiscovery,
    selectAzguardProvider,
    confirmAzguardConnection,
    cancelAzguardConnection,
    status,
    error,
    clearError,
    azguard,
  } = useMultiWalletStore();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [hasAzguard, setHasAzguard] = useState(false);
  const [view, setView] = useState<ModalView>('select');

  useEffect(() => {
    isAzguardInstalled().then(setHasAzguard);
  }, []);

  const handleEmbedded = async () => {
    if (connecting) return;
    clearError();
    setConnecting('embedded');
    try {
      await connectEmbedded();
    } finally {
      setConnecting(null);
    }
  };

  const handleAzguard = () => {
    clearError();
    setView('azguard-discovery');
    startAzguardDiscovery();
  };

  const handleSelectProvider = async (provider: WalletProvider) => {
    await selectAzguardProvider(provider);
    setView('azguard-verify');
  };

  const handleConfirm = async () => {
    await confirmAzguardConnection();
  };

  const handleBack = () => {
    cancelAzguardConnection();
    setView('select');
  };

  const walletOptions: WalletOption[] = [
    {
      id: 'embedded',
      name: 'Embedded Wallet',
      description: 'Instant play — account created automatically in your browser',
      icon: '🔑',
      action: handleEmbedded,
      available: true,
    },
    {
      id: 'azguard',
      name: 'Azguard',
      description: 'Use the Azguard Aztec browser wallet extension',
      icon: '🛡️',
      action: handleAzguard,
      available: hasAzguard,
      unavailableReason: 'Azguard not detected. Install the extension and refresh.',
    },
  ];

  const isConnecting =
    status === 'connecting' || status === 'discovering' || connecting !== null;

  // --- Azguard Discovery View ---
  if (view === 'azguard-discovery') {
    return (
      <div className="lobby-form" style={{ gap: '12px' }}>
        <button
          className="glass-btn-secondary"
          onClick={handleBack}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            alignSelf: 'flex-start',
          }}
        >
          ← Back
        </button>

        <p
          style={{
            margin: '0',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          Searching for Azguard wallets...
        </p>

        {error && (
          <div
            className="error-toast"
            style={{ marginBottom: '4px' }}
            onClick={clearError}
          >
            {error}
          </div>
        )}

        {status === 'discovering' && azguard.providers.length === 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '20px 0',
            }}
          >
            <div
              className="loading-spinner"
              style={{ width: '28px', height: '28px' }}
            />
          </div>
        )}

        {azguard.providers.map((provider) => (
          <button
            key={provider.id}
            className="glass-btn lobby-btn-full"
            onClick={() => handleSelectProvider(provider)}
            disabled={status === 'connecting'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              textAlign: 'left',
            }}
          >
            {canRenderProviderIcon(provider.icon) ? (
              <img
                src={provider.icon}
                alt=""
                style={{
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  borderRadius: '4px',
                }}
              />
            ) : (
              <span style={{ fontSize: '24px', flexShrink: 0 }}>🛡️</span>
            )}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                flex: 1,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '15px' }}>
                {provider.name || 'Azguard Wallet'}
              </span>
              <span style={{ fontSize: '12px', opacity: 0.75 }}>
                Click to connect
              </span>
            </span>
          </button>
        ))}

        {status !== 'discovering' && azguard.providers.length === 0 && !error && (
          <p
            style={{
              margin: '8px 0 0',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            No wallets found. Make sure Azguard is installed and unlocked.
          </p>
        )}
      </div>
    );
  }

  // --- Azguard Verification View ---
  if (view === 'azguard-verify') {
    const emojis = azguard.verificationEmojis;
    const isConfirming = status === 'connecting';

    return (
      <div className="lobby-form" style={{ gap: '12px' }}>
        <button
          className="glass-btn-secondary"
          onClick={handleBack}
          disabled={isConfirming}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            alignSelf: 'flex-start',
          }}
        >
          ← Back
        </button>

        <p
          style={{
            margin: '0',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          Verify these emojis match your wallet
        </p>

        {error && (
          <div
            className="error-toast"
            style={{ marginBottom: '4px' }}
            onClick={clearError}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {emojis.map((emoji, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
              }}
            >
              {emoji}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="glass-btn-secondary lobby-btn-full"
            onClick={handleBack}
            disabled={isConfirming}
            style={{ padding: '12px', flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="glass-btn lobby-btn-full"
            onClick={handleConfirm}
            disabled={isConfirming}
            style={{
              padding: '12px',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isConfirming ? (
              <>
                Confirming...
                <div
                  className="loading-spinner"
                  style={{ width: '16px', height: '16px' }}
                />
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- Default: Wallet Selection View ---
  return (
    <div className="lobby-form" style={{ gap: '12px' }}>
      <p
        style={{
          margin: '0 0 8px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        Choose how to connect to Aztec Network
      </p>

      {error && (
        <div
          className="error-toast"
          style={{ marginBottom: '8px' }}
          onClick={clearError}
        >
          {error}
        </div>
      )}

      {walletOptions.map((option) => (
        <button
          key={option.id}
          className={
            option.available
              ? 'glass-btn lobby-btn-full'
              : 'glass-btn-secondary lobby-btn-full'
          }
          onClick={option.action}
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
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              flex: 1,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              {connecting === option.id
                ? `Connecting ${option.name}...`
                : option.name}
            </span>
            <span style={{ fontSize: '12px', opacity: 0.75 }}>
              {option.available
                ? option.description
                : option.unavailableReason}
            </span>
          </span>
          {connecting === option.id && (
            <div
              className="loading-spinner"
              style={{ width: '20px', height: '20px', flexShrink: 0 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
