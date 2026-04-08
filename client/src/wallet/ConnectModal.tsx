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
import { getNetworkConfig, usesSponsoredFeePayment } from '../config/network';

type ModalView = 'select' | 'azguard-discovery' | 'azguard-verify';

function canRenderProviderIcon(icon: string | undefined): boolean {
  if (!icon) {
    return false;
  }

  return /^(https?:|data:|blob:)/.test(icon);
}

function AzguardBrand() {
  return (
    <span className="menu-azguard-brand" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        className="menu-azguard-brand__mark"
      >
        <path d="M23.5136 8.56475L15.9638 11.5562L24 12.5649C23.9904 12.7717 23.9756 12.9771 23.9556 13.181L15.7905 13.2H15.6036L21.6109 19.2005C19.4191 22.1149 15.9297 24 11.9996 24V13.2V9.6L8.3955 13.2H8.20856H0.0453531C0.0250791 12.996 0.00991815 12.7906 0 12.5837L8.0353 11.5562L0.485523 8.56475C0.544436 8.36744 0.608294 8.17226 0.676953 7.97936L8.5475 9.98425L2.87507 4.19384C3.00912 4.03763 3.14713 3.88492 3.28894 3.73583L9.65659 8.75594L6.83519 1.16227C7.02067 1.07392 7.20877 0.990194 7.39934 0.911222L11.1708 8.08366L11.6905 0.00389262C11.7932 0.00130272 11.8962 0 11.9996 0C12.1029 0 12.2059 0.00130266 12.3086 0.00389243L12.8283 8.08366L16.5998 0.911219C16.7903 0.99019 16.9784 1.07392 17.1639 1.16226L14.3425 8.75594L20.7102 3.73583C20.852 3.88491 20.99 4.03763 21.124 4.19383L15.4516 9.98425L23.3222 7.97936C23.3908 8.17226 23.4547 8.36744 23.5136 8.56475Z" />
      </svg>
      <svg
        viewBox="0 0 101 22"
        width="101"
        height="22"
        className="menu-azguard-brand__wordmark"
      >
        <path d="M4.032 13.352V11.024H13.296V13.352H4.032ZM0.432 17L7.224 1.448H10.152L16.992 17H14.04L8.088 2.96H9.288L3.36 17H0.432ZM29.7975 7.208L21.0855 15.68L20.7735 14.84H29.9415V17H18.7815V14.84L27.5415 6.392L27.8775 7.208H18.7815V5.048H29.7975V7.208ZM37.8941 15.152C36.7741 15.152 35.7581 14.952 34.8461 14.552C33.9501 14.152 33.2381 13.568 32.7101 12.8C32.1981 12.032 31.9421 11.112 31.9421 10.04C31.9421 8.968 32.1901 8.04 32.6861 7.256C33.1981 6.472 33.9021 5.864 34.7981 5.432C35.7101 5 36.7421 4.784 37.8941 4.784C38.2301 4.784 38.5501 4.808 38.8541 4.856C39.1741 4.904 39.4781 4.968 39.7661 5.048L45.3581 5.072V7.304C44.5901 7.32 43.8141 7.216 43.0301 6.992C42.2621 6.752 41.5821 6.504 40.9901 6.248L40.9181 6.104C41.4621 6.376 41.9501 6.712 42.3821 7.112C42.8301 7.496 43.1821 7.936 43.4381 8.432C43.6941 8.928 43.8221 9.488 43.8221 10.112C43.8221 11.168 43.5661 12.072 43.0541 12.824C42.5581 13.576 41.8621 14.152 40.9661 14.552C40.0861 14.952 39.0621 15.152 37.8941 15.152ZM41.7341 21.872V21.32C41.7341 20.536 41.5021 19.984 41.0381 19.664C40.5741 19.344 39.9261 19.184 39.0941 19.184H35.8541C35.2141 19.184 34.6621 19.128 34.1981 19.016C33.7501 18.92 33.3901 18.768 33.1181 18.56C32.8461 18.368 32.6461 18.136 32.5181 17.864C32.3901 17.608 32.3261 17.32 32.3261 17C32.3261 16.36 32.5181 15.88 32.9021 15.56C33.3021 15.24 33.8221 15.032 34.4621 14.936C35.1181 14.84 35.8061 14.824 36.5261 14.888L37.8941 15.152C36.9501 15.184 36.2301 15.272 35.7341 15.416C35.2541 15.544 35.0141 15.808 35.0141 16.208C35.0141 16.448 35.1101 16.64 35.3021 16.784C35.4941 16.928 35.7661 17 36.1181 17H39.5261C40.5021 17 41.3581 17.112 42.0941 17.336C42.8301 17.576 43.3981 17.968 43.7981 18.512C44.2141 19.072 44.4221 19.832 44.4221 20.792V21.872H41.7341ZM37.8941 13.064C38.5341 13.064 39.1021 12.944 39.5981 12.704C40.0941 12.464 40.4861 12.12 40.7741 11.672C41.0621 11.224 41.2061 10.68 41.2061 10.04C41.2061 9.4 41.0621 8.848 40.7741 8.384C40.4861 7.92 40.0941 7.568 39.5981 7.328C39.1021 7.088 38.5341 6.968 37.8941 6.968C37.2701 6.968 36.7021 7.088 36.1901 7.328C35.6941 7.568 35.3021 7.92 35.0141 8.384C34.7261 8.832 34.5821 9.384 34.5821 10.04C34.5821 10.68 34.7261 11.224 35.0141 11.672C35.3021 12.12 35.6941 12.464 36.1901 12.704C36.6861 12.944 37.2541 13.064 37.8941 13.064ZM59.9518 17H57.2878V5.048H59.9518V17ZM57.4318 11.312L57.4558 12.08C57.4238 12.288 57.3518 12.6 57.2398 13.016C57.1438 13.432 56.9758 13.888 56.7358 14.384C56.5118 14.864 56.2078 15.328 55.8238 15.776C55.4558 16.208 54.9918 16.568 54.4318 16.856C53.8718 17.128 53.1918 17.264 52.3918 17.264C51.8158 17.264 51.2318 17.184 50.6398 17.024C50.0638 16.88 49.5358 16.632 49.0558 16.28C48.5918 15.928 48.2158 15.448 47.9278 14.84C47.6398 14.232 47.4958 13.464 47.4958 12.536V5.048H50.1598V12.032C50.1598 12.784 50.2798 13.376 50.5198 13.808C50.7758 14.224 51.1278 14.52 51.5758 14.696C52.0238 14.872 52.5438 14.96 53.1358 14.96C53.9838 14.96 54.7038 14.768 55.2958 14.384C55.8878 14 56.3598 13.528 56.7118 12.968C57.0798 12.392 57.3198 11.84 57.4318 11.312ZM68.2223 17.264C67.1343 17.264 66.1343 17 65.2223 16.472C64.3263 15.944 63.6063 15.216 63.0623 14.288C62.5343 13.344 62.2703 12.264 62.2703 11.048C62.2703 9.8 62.5423 8.712 63.0863 7.784C63.6303 6.84 64.3663 6.104 65.2943 5.576C66.2223 5.048 67.2623 4.784 68.4143 4.784C69.6943 4.784 70.7103 5.064 71.4623 5.624C72.2143 6.184 72.7503 6.936 73.0703 7.88C73.3903 8.824 73.5503 9.88 73.5503 11.048C73.5503 11.704 73.4543 12.4 73.2623 13.136C73.0703 13.856 72.7663 14.528 72.3503 15.152C71.9503 15.776 71.4063 16.288 70.7183 16.688C70.0463 17.072 69.2143 17.264 68.2223 17.264ZM69.0383 15.056C69.9343 15.056 70.6943 14.888 71.3183 14.552C71.9583 14.2 72.4383 13.72 72.7583 13.112C73.0943 12.504 73.2623 11.816 73.2623 11.048C73.2623 10.2 73.0943 9.48 72.7583 8.888C72.4223 8.28 71.9423 7.816 71.3183 7.496C70.6943 7.16 69.9343 6.992 69.0383 6.992C67.7583 6.992 66.7663 7.368 66.0623 8.12C65.3583 8.872 65.0063 9.848 65.0063 11.048C65.0063 11.832 65.1743 12.528 65.5103 13.136C65.8623 13.744 66.3423 14.216 66.9503 14.552C67.5583 14.888 68.2543 15.056 69.0383 15.056ZM73.2623 5.048H75.9503V17H73.4543C73.4543 17 73.4383 16.848 73.4062 16.544C73.3743 16.24 73.3423 15.872 73.3103 15.44C73.2783 14.992 73.2623 14.568 73.2623 14.168V5.048ZM78.8786 5.048H81.5426V17H78.8786V5.048ZM85.8626 7.328C84.9986 7.328 84.2546 7.512 83.6306 7.88C83.0226 8.248 82.5346 8.696 82.1666 9.224C81.7986 9.752 81.5426 10.264 81.3986 10.76L81.3746 9.416C81.3906 9.24 81.4466 8.976 81.5426 8.624C81.6386 8.256 81.7826 7.856 81.9746 7.424C82.1826 6.992 82.4546 6.576 82.7906 6.176C83.1426 5.76 83.5666 5.424 84.0626 5.168C84.5746 4.912 85.1746 4.784 85.8626 4.784V7.328ZM93.2066 17.264C92.1026 17.264 91.0946 17 90.1826 16.472C89.2866 15.944 88.5746 15.216 88.0466 14.288C87.5186 13.344 87.2546 12.264 87.2546 11.048C87.2546 9.8 87.5106 8.712 88.0226 7.784C88.5506 6.84 89.2546 6.104 90.1346 5.576C91.0306 5.048 92.0546 4.784 93.2066 4.784C94.2146 4.784 95.0626 4.952 95.7506 5.288C96.4386 5.608 96.9826 6.056 97.3826 6.632C97.7826 7.192 98.0706 7.848 98.2466 8.6C98.4386 9.352 98.5346 10.168 98.5346 11.048C98.5346 11.704 98.4386 12.4 98.2466 13.136C98.0546 13.856 97.7506 14.528 97.3346 15.152C96.9346 15.776 96.3906 16.288 95.7026 16.688C95.0306 17.072 94.1986 17.264 93.2066 17.264ZM94.0226 15.056C94.9186 15.056 95.6786 14.888 96.3026 14.552C96.9426 14.2 97.4226 13.72 97.7426 13.112C98.0786 12.504 98.2466 11.816 98.2466 11.048C98.2466 10.2 98.0786 9.48 97.7426 8.888C97.4066 8.28 96.9266 7.808 96.3026 7.472C95.6786 7.136 94.9186 6.968 94.0226 6.968C92.7426 6.968 91.7506 7.352 91.0466 8.12C90.3426 8.872 89.9906 9.848 89.9906 11.048C89.9906 11.832 90.1586 12.528 90.4946 13.136C90.8466 13.744 91.3266 14.216 91.9346 14.552C92.5426 14.888 93.2386 15.056 94.0226 15.056ZM98.2466 0.248H100.935V17H98.4386C98.4066 16.632 98.3666 16.176 98.3186 15.632C98.2706 15.088 98.2466 14.6 98.2466 14.168V0.248Z" />
      </svg>
    </span>
  );
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
  const [autoSelectingProviderId, setAutoSelectingProviderId] = useState<string | null>(null);
  const networkConfig = getNetworkConfig();
  const remoteEmbeddedFlow = !usesSponsoredFeePayment(networkConfig.nodeUrl);

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
    setAutoSelectingProviderId(null);
    setView('azguard-discovery');
    startAzguardDiscovery();
  };

  const handleSelectProvider = async (provider: WalletProvider) => {
    await selectAzguardProvider(provider);
    const nextState = useMultiWalletStore.getState();
    if (nextState.status === 'verifying' && nextState.azguard.pending) {
      setView('azguard-verify');
    }
  };

  const handleConfirm = async () => {
    await confirmAzguardConnection();
  };

  const handleBack = () => {
    cancelAzguardConnection();
    setAutoSelectingProviderId(null);
    setView('select');
  };

  const isConnecting =
    status === 'connecting' || status === 'discovering' || connecting !== null;

  useEffect(() => {
    if (view !== 'azguard-discovery') {
      return;
    }

    if (azguard.providers.length !== 1) {
      return;
    }

    const [provider] = azguard.providers;
    if (!provider) {
      return;
    }

    if (autoSelectingProviderId === provider.id) {
      return;
    }

    if (status === 'connecting' || status === 'verifying' || azguard.pending) {
      return;
    }

    setAutoSelectingProviderId(provider.id);
    void handleSelectProvider(provider);
  }, [
    azguard.pending,
    azguard.providers,
    autoSelectingProviderId,
    status,
    view,
  ]);

  // --- Azguard Discovery View ---
  if (view === 'azguard-discovery') {
    const singleProvider = azguard.providers.length === 1 ? azguard.providers[0] : null;
    const isAutoConnectingSingleProvider =
      !!singleProvider &&
      (autoSelectingProviderId === singleProvider.id ||
        status === 'connecting' ||
        status === 'verifying');

    return (
      <div className="menu-connect-content menu-connect-content--flow">
        <button
          type="button"
          className="menu-flow-back"
          onClick={handleBack}
        >
          ← BACK
        </button>

        <p className="menu-panel-kicker">AZGUARD</p>
        <p className="menu-flow-copy">
          {singleProvider
            ? 'Unlock the extension. We will connect to your wallet automatically.'
            : 'Unlock the extension and choose a wallet to continue.'}
        </p>

        {error && (
          <div className="menu-inline-error" onClick={clearError}>
            {error}
          </div>
        )}

        {status === 'discovering' && azguard.providers.length === 0 && (
          <div className="menu-flow-spinner">
            <div
              className="loading-spinner"
              style={{ width: '28px', height: '28px' }}
            />
          </div>
        )}

        {isAutoConnectingSingleProvider ? (
          <div className="menu-flow-spinner">
            <div
              className="loading-spinner"
              style={{ width: '28px', height: '28px' }}
            />
          </div>
        ) : (
          <div className="menu-provider-list">
            {azguard.providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="menu-provider-button"
                onClick={() => handleSelectProvider(provider)}
                disabled={status === 'connecting'}
              >
                {canRenderProviderIcon(provider.icon) ? (
                  <img
                    src={provider.icon}
                    alt=""
                    className="menu-provider-button__icon"
                  />
                ) : (
                  <span className="menu-provider-button__fallback">🛡️</span>
                )}
                <span className="menu-provider-button__content">
                  <span className="menu-provider-button__name">
                    {provider.name || 'Azguard Wallet'}
                  </span>
                  <span className="menu-provider-button__hint">CLICK TO CONNECT</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {status !== 'discovering' && azguard.providers.length === 0 && !error && (
          <p className="menu-flow-note">
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
      <div className="menu-connect-content menu-connect-content--flow">
        <button
          type="button"
          className="menu-flow-back"
          onClick={handleBack}
          disabled={isConfirming}
        >
          ← BACK
        </button>

        <p className="menu-panel-kicker">VERIFY AZGUARD</p>
        <p className="menu-flow-copy">
          Confirm these emojis match the ones shown in your wallet.
        </p>

        {error && (
          <div className="menu-inline-error" onClick={clearError}>
            {error}
          </div>
        )}

        <div className="menu-emoji-grid">
          {emojis.map((emoji, i) => (
            <div key={i} className="menu-emoji-grid__cell">
              {emoji}
            </div>
          ))}
        </div>

        <div className="menu-flow-actions">
          <button
            type="button"
            className="menu-flow-button menu-flow-button--secondary"
            onClick={handleBack}
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="menu-flow-button menu-flow-button--primary"
            onClick={handleConfirm}
            disabled={isConfirming}
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
    <div className="menu-connect-content">
      <p className="menu-panel-kicker">CONNECT WITH</p>

      {error && (
        <div className="menu-inline-error" onClick={clearError}>
          {error}
        </div>
      )}

      <div className="menu-connect-actions">
        <button
          type="button"
          className="menu-wallet-button menu-wallet-button--embedded"
          onClick={handleEmbedded}
          disabled={isConnecting}
        >
          <span className="menu-wallet-button__label">
            {connecting === 'embedded' ? '' : 'EMBEDDED WALLET'}
          </span>
          {connecting === 'embedded' && (
            <div
              className="loading-spinner"
              style={{ width: '25px', height: '25px', flexShrink: 0 }}
            />
          )}
        </button>

        {remoteEmbeddedFlow && (
          <p className="menu-flow-note menu-connect-note">
            Requires an L1 wallet with ETH to bridge Fee Juice before the first transaction.
          </p>
        )}

        <button
          type="button"
          className="menu-wallet-button menu-wallet-button--azguard"
          onClick={handleAzguard}
          disabled={isConnecting || !hasAzguard}
        >
          <AzguardBrand />
        </button>
      </div>

      {!hasAzguard && (
        <p className="menu-wallet-helper">
          Azguard not detected. Install the extension and refresh.
        </p>
      )}
    </div>
  );
}
