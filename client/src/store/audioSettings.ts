import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioSettingsStore {
  musicVolume: number;
  sfxVolume: number;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

function clampVolume(volume: number) {
  if (Number.isNaN(volume)) {
    return 0;
  }

  return Math.min(1, Math.max(0, volume));
}

export const useAudioSettingsStore = create<AudioSettingsStore>()(
  persist(
    (set) => ({
      musicVolume: 1,
      sfxVolume: 1,
      setMusicVolume: (volume) => set({ musicVolume: clampVolume(volume) }),
      setSfxVolume: (volume) => set({ sfxVolume: clampVolume(volume) }),
    }),
    {
      name: 'treasure-hunt-audio-settings',
    }
  )
);
