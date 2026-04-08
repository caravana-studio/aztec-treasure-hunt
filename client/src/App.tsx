import { Routes, Route, useLocation } from 'react-router-dom';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { useIsDesktopSupported } from './utils/device';
import { useBackgroundMusic } from './hooks/useBackgroundMusic';
import { SettingsModal } from './components/ui/SettingsModal';

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
  const location = useLocation();
  const isGameRoute = location.pathname.startsWith('/game/');
  const backgroundMusicTrack = isGameRoute ? '/sounds/game_music.mp3' : '/sounds/menu_music.mp3';
  const backgroundMusicVolume = isGameRoute ? 0.22 : 0.2;

  useBackgroundMusic(backgroundMusicTrack, backgroundMusicVolume);

  if (!isDesktopSupported) {
    return <UnsupportedDeviceScreen />;
  }

  return (
    <>
      <SettingsModal />
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game/:id" element={<Game />} />
      </Routes>
    </>
  );
}

export default App;
