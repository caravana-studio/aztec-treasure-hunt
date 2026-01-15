import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { useGame } from '../hooks/useGame';

export function Lobby() {
  const navigate = useNavigate();
  const { myAddress, isConnecting, createAccount, connectTestAccount } = useWallet();
  const { createGame, joinGame, isLoading, error, setError } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [testAccountIndex, setTestAccountIndex] = useState(0);

  const handleCreateGame = async () => {
    if (!gameIdInput) return;
    const id = await createGame(gameIdInput);
    if (id) {
      navigate(`/game/${gameIdInput}`);
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
      <div className="lobby-card">
        <img src="/images/logo.png" alt="Treasure Hunt" className="lobby-title" />
        <p className="lobby-subtitle">Strategic treasure hunting with truly private game state on Aztec Network</p>

        {error && (
          <div className="error-toast" onClick={() => setError(null)}>
            {error}
          </div>
        )}

        {!myAddress ? (
          <div className="lobby-form">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                className="glass-input"
                value={testAccountIndex}
                onChange={(e) => setTestAccountIndex(Number(e.target.value))}
                style={{ flex: 1 }}
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

            <div
              style={{
                textAlign: 'center',
                color: 'rgba(0,0,0,0.4)',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.5px',
              }}
            >
              or
            </div>

            <button
              className="glass-btn-secondary"
              onClick={createAccount}
              disabled={isConnecting}
              style={{ width: '100%' }}
            >
              {isConnecting ? 'Creating...' : 'Create New Account'}
            </button>
          </div>
        ) : (
          <div className="lobby-form">
            <div
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(145deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.06) 100%)',
                borderRadius: '16px',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace',
                textAlign: 'center',
                marginBottom: '8px',
                color: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {myAddress.toString().slice(0, 10)}...{myAddress.toString().slice(-8)}
            </div>

            <input
              type="number"
              className="glass-input"
              placeholder="Enter Game ID"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              min="1"
            />

            <div className="lobby-buttons">
              <button
                className="glass-btn"
                onClick={handleCreateGame}
                disabled={isLoading || !gameIdInput}
              >
                {isLoading ? 'Creating...' : 'Create Game'}
              </button>
              <button
                className="glass-btn-secondary"
                onClick={handleJoinGame}
                disabled={isLoading || !gameIdInput}
              >
                {isLoading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginTop: '20px',
              color: 'rgba(0,0,0,0.5)',
              fontWeight: 500,
            }}
          >
            <div className="loading-spinner" />
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
