import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useMultiWalletStore } from '../wallet/store';
import { useGame } from '../hooks/useGame';
import { AnimatedClouds } from '../components/ui/AnimatedClouds';
import { ConnectModal } from '../wallet/ConnectModal';

export function Lobby() {
  const navigate = useNavigate();
  const { myAddress, error: walletError, clearError: clearWalletError } = useWallet();
  const { disconnect, walletType } = useMultiWalletStore();
  const { createGame, joinGame, isLoading, statusMessage, error: gameError, setError: setGameError } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');

  const handleCreateGame = async () => {
    const id = await createGame();
    if (id) {
      navigate(`/game/${id.toString()}`);
    }
  };

  const handleJoinGame = async () => {
    if (!gameIdInput) return;
    const id = await joinGame(gameIdInput);
    if (id) {
      navigate(`/game/${gameIdInput}`);
    }
  };

  const error = walletError || gameError;
  const clearError = () => {
    clearWalletError();
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
      <div className="lobby-container">
        <AnimatedClouds />
        <img src="/images/logo.png" alt="Treasure Hunt" className="lobby-logo" />
        <div className="lobby-card">
          <p className="lobby-subtitle">
            Strategic treasure hunting with truly private game state on Aztec Network
          </p>

          {error && (
            <div className="error-toast" onClick={clearError}>
              {error}
            </div>
          )}

          {!myAddress ? (
            <ConnectModal />
          ) : (
            <div className="lobby-form">
              {/* Connected account info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <div className="lobby-address">
                  {myAddress.toString().slice(0, 10)}...{myAddress.toString().slice(-8)}
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)',
                }}>
                  {walletLabel}
                </span>
              </div>

              <button
                className="glass-btn lobby-btn-full"
                onClick={handleCreateGame}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create New Game'}
              </button>

              <div className="lobby-divider">or join existing</div>

              <div className="lobby-row">
                <input
                  type="number"
                  className="glass-input"
                  placeholder="Game ID"
                  value={gameIdInput}
                  onChange={(e) => setGameIdInput(e.target.value)}
                  min="1"
                />
                <button
                  className="glass-btn-secondary"
                  onClick={handleJoinGame}
                  disabled={isLoading || !gameIdInput}
                >
                  {isLoading ? 'Joining...' : 'Join'}
                </button>
              </div>

              <button
                className="glass-btn-secondary lobby-btn-full"
                onClick={disconnect}
                style={{ fontSize: '13px', opacity: 0.7 }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

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
