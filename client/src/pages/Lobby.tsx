import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useGame } from '../hooks/useGame';
import { AnimatedClouds } from '../components/ui/AnimatedClouds';

export function Lobby() {
  const navigate = useNavigate();
  const { myAddress, isConnecting, createAccount, connectTestAccount } = useWallet();
  const { createGame, joinGame, isLoading, statusMessage, error, setError } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [testAccountIndex, setTestAccountIndex] = useState(0);

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

  const handleConnectTestAccount = async () => {
    await connectTestAccount(testAccountIndex);
  };

  return (
    <div className="lobby-container">
      <AnimatedClouds />
      <img src="/images/logo.png" alt="Treasure Hunt" className="lobby-logo" />
      <div className="lobby-card">
        <p className="lobby-subtitle">Strategic treasure hunting with truly private game state on Aztec Network</p>

        {error && (
          <div className="error-toast" onClick={() => setError(null)}>
            {error}
          </div>
        )}

        {!myAddress ? (
          <div className="lobby-form">
            <div className="lobby-row">
              <select
                className="glass-input"
                value={testAccountIndex}
                onChange={(e) => setTestAccountIndex(Number(e.target.value))}
              >
                <option value={0}>Test Account 1</option>
                <option value={1}>Test Account 2</option>
                <option value={2}>Test Account 3</option>
              </select>
              <button
                className="glass-btn"
                onClick={handleConnectTestAccount}
                disabled={isConnecting}
              >
                Connect
              </button>
            </div>

            <div className="lobby-divider">or</div>

            <button
              className="glass-btn-secondary lobby-btn-full"
              onClick={createAccount}
              disabled={isConnecting}
            >
              {isConnecting ? 'Creating...' : 'Create New Account'}
            </button>
          </div>
        ) : (
          <div className="lobby-form">
            <div className="lobby-address">
              {myAddress.toString().slice(0, 10)}...{myAddress.toString().slice(-8)}
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
          </div>
        )}

      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p>{statusMessage || 'Processing...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
