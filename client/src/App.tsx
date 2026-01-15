import { Routes, Route, Navigate } from 'react-router-dom';
import { useWallet } from './context/WalletContext';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';

function LoadingScreen() {
  return (
    <div className="lobby-container">
      <div className="lobby-card" style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p>Connecting to Aztec network...</p>
      </div>
    </div>
  );
}

function App() {
  const { isInitializing, error } = useWallet();

  if (isInitializing) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="lobby-container">
        <div className="lobby-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '16px' }}>Connection Error</h2>
          <p style={{ marginBottom: '16px' }}>{error}</p>
          <button className="glass-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/game/:id" element={<Game />} />
    </Routes>
  );
}

export default App;
