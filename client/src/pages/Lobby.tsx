import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useMultiWalletStore } from '../wallet/store';
import { useGame } from '../hooks/useGame';
import { AcceleratorBadge } from '../components/ui/AcceleratorBadge';
import { ConnectModal } from '../wallet/ConnectModal';
import { getNetworkConfig } from '../config/network';
import { AnimatedClouds } from '../components/ui/AnimatedClouds';

function getNetworkLabel(nodeUrl: string): string {
  if (nodeUrl.includes('localhost') || nodeUrl.includes('127.0.0.1')) {
    return 'Aztec Local';
  }
  if (nodeUrl.includes('devnet')) {
    return 'Aztec Devnet';
  }
  if (nodeUrl.includes('testnet')) {
    return 'Aztec Testnet';
  }
  if (nodeUrl.includes('mainnet')) {
    return 'Aztec Mainnet';
  }
  return 'Aztec Network';
}

export function Lobby() {
  const navigate = useNavigate();
  const { myAddress, isInitializing } = useWallet();
  const { disconnect, walletType } = useMultiWalletStore();
  const { createGame, joinGame, isLoading, statusMessage, error: gameError, setError: setGameError } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const networkLabel = getNetworkLabel(getNetworkConfig().nodeUrl);

  useEffect(() => {
    if (!showJoinPanel) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowJoinPanel(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showJoinPanel]);

  const handleCreateGame = async () => {
    if (!myAddress) {
      setGameError('Connect your wallet first.');
      return;
    }

    setShowJoinPanel(false);
    const id = await createGame();
    if (id) {
      navigate(`/game/${id.toString()}`);
    }
  };

  const handleJoinGame = async () => {
    if (!myAddress) {
      setGameError('Connect your wallet first.');
      return;
    }
    if (!gameIdInput) return;
    const id = await joinGame(gameIdInput);
    if (id) {
      setShowJoinPanel(false);
      navigate(`/game/${id.toString()}`);
    }
  };

  const handleJoinCard = () => {
    if (!myAddress) {
      setGameError('Connect your wallet first.');
      return;
    }

    setShowJoinPanel(true);
  };

  const error = gameError;
  const clearError = () => {
    setGameError(null);
  };

  const walletLabel =
    walletType === 'embedded'
      ? 'Embedded Wallet'
      : walletType === 'azguard'
      ? 'Azguard'
      : 'Connected';

  return (
    <>
      <div className="menu-screen">
        <AnimatedClouds className="menu-clouds" />
        <div className="menu-screen__shade" />

        <div className="menu-shell">
          {error && (
            <div className="error-toast menu-error-toast" onClick={clearError}>
              {error}
            </div>
          )}

          <main className="menu-stage">
            <section className="menu-column menu-column--left">
              <header className="menu-brand">
                <img src="/menu/logo.png" alt="Treasure Hunt" className="menu-brand__logo" />
              </header>

              <aside className="menu-connect-panel">
                {!myAddress ? (
                  <ConnectModal />
                ) : (
                  <div className="menu-session">
                    <p className="menu-panel-kicker">CONNECTED WITH</p>

                    <div className="menu-session__wallet-row">
                      <div className="menu-session__wallet">{walletLabel}</div>
                      {walletType === 'embedded' && (
                        <div className="menu-session__accelerator">
                          <AcceleratorBadge />
                        </div>
                      )}
                    </div>

                    <div className="menu-session__address">
                      {myAddress.toString().slice(0, 10)}...{myAddress.toString().slice(-8)}
                    </div>

                    <button
                      type="button"
                      className="menu-session__disconnect"
                      onClick={disconnect}
                    >
                      DISCONNECT
                    </button>
                  </div>
                )}

                <img
                  src="/menu/aztec_logo.png"
                  alt="Aztec"
                  className="menu-connect-panel__brand"
                />
              </aside>
            </section>

            <section className="menu-column menu-column--right">
              <div className="menu-actions">
                <button
                  type="button"
                  className={`menu-action-card menu-action-card--new${!myAddress ? ' is-locked' : ''}`}
                  onClick={handleCreateGame}
                  disabled={isLoading}
                >
                  <img src="/menu/new.png" alt="" className="menu-action-card__image" />
                  <span className="menu-action-card__label">NEW</span>
                  {!myAddress && (
                    <span className="menu-action-card__hint">CONNECT TO UNLOCK</span>
                  )}
                  {isLoading && (
                    <span className="menu-action-card__status">
                      {statusMessage || 'PROCESSING...'}
                    </span>
                  )}
                </button>

                <div className="menu-action-stack">
                  <button
                    type="button"
                    className={`menu-action-card menu-action-card--join${!myAddress ? ' is-locked' : ''}`}
                    onClick={handleJoinCard}
                    disabled={isLoading}
                  >
                    <img src="/menu/join.png" alt="" className="menu-action-card__image" />
                    <span className="menu-action-card__label">JOIN</span>
                    {!myAddress && (
                      <span className="menu-action-card__hint">CONNECT TO UNLOCK</span>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </main>

          <footer className="menu-footer">
            Treasure Hunt v0.1.0 · Created by @dub_zn and @dpinoness · {networkLabel}
          </footer>
        </div>
      </div>

      {showJoinPanel && (
        <div
          className="menu-join-modal"
          onClick={() => setShowJoinPanel(false)}
        >
          <div
            className="menu-join-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="menu-join-modal__close"
              onClick={() => setShowJoinPanel(false)}
              aria-label="Close join modal"
            >
              ×
            </button>

            <div className="menu-join-modal__hero">
              <img src="/menu/join.png" alt="" className="menu-join-modal__hero-image" />
            </div>

            <div className="menu-join-modal__body">
              <p className="menu-join-modal__title">ENTER GAME ID</p>

              <div className="menu-join-modal__actions">
                <input
                  type="text"
                  className="menu-join-modal__input"
                  value={gameIdInput}
                  onChange={(e) => setGameIdInput(e.target.value.replace(/\D+/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleJoinGame();
                    }
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <button
                  type="button"
                  className="menu-join-modal__submit"
                  onClick={handleJoinGame}
                  disabled={isLoading || !gameIdInput}
                >
                  {isLoading ? '...' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInitializing && (
        <div className="menu-startup-modal" aria-live="polite" aria-busy="true">
          <div className="menu-startup-modal__dialog">
            <div className="loading-spinner" />
            <p className="menu-startup-modal__eyebrow">INITIALIZING</p>
            <p className="menu-startup-modal__copy">Connecting to Aztec network...</p>
          </div>
        </div>
      )}

      {/* Loading overlay — outside lobby-container to avoid transform issues */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p>{statusMessage || 'Processing...'}</p>
          </div>
        </div>
      )}
    </>
  );
}
