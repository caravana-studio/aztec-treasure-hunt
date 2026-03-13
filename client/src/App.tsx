import { Routes, Route, Navigate } from 'react-router-dom';
import { useWallet } from './context/WalletContext';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { AnimatedClouds } from './components/ui/AnimatedClouds';

function LoadingScreen() {
  return (
    <div className="lobby-container">
      <AnimatedClouds />
      <div className="lobby-card" style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ margin: 0, color: 'white', textAlign: 'center' }}>Connecting to Aztec network...</p>
      </div>
    </div>
  );
}

function App() {
  const { isInitializing } = useWallet();

  // Only block render while PXE is initializing.
  // Wallet connection errors are shown inline in ConnectModal.
  if (isInitializing) {
    return <LoadingScreen />;
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
