import { Routes, Route } from 'react-router-dom';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { useIsDesktopSupported } from './utils/device';

function UnsupportedDeviceScreen() {
  return (
    <div className="unsupported-screen">
      <div className="unsupported-screen__shade" />
      <div className="unsupported-card">
        <img
          src="/menu/logo.png"
          alt="Treasure Hunt"
          className="unsupported-card__logo"
        />
        <p className="unsupported-card__eyebrow">Desktop Only</p>
        <h1 className="unsupported-card__title">This game is not supported on mobile or tablet.</h1>
        <p className="unsupported-card__copy">
          Open Treasure Hunt from a desktop or laptop browser to connect your wallet
          and play.
        </p>
      </div>
    </div>
  );
}

function App() {
  const isDesktopSupported = useIsDesktopSupported();

  if (!isDesktopSupported) {
    return <UnsupportedDeviceScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/game/:id" element={<Game />} />
    </Routes>
  );
}

export default App;
