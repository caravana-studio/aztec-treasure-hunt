import { useEffect } from 'react';
import { useAudioSettingsStore } from '../store/audioSettings';

const FADE_DURATION_MS = 700;
const FADE_INTERVAL_MS = 40;

let currentAudio: HTMLAudioElement | null = null;
let currentTrack = '';
let currentVolume = 0;
let unlockListenersAttached = false;
let visibilityListenerAttached = false;
const fadeTimers = new WeakMap<HTMLAudioElement, number>();

function clearFadeTimer(audio: HTMLAudioElement) {
  const timer = fadeTimers.get(audio);
  if (timer !== undefined) {
    window.clearInterval(timer);
    fadeTimers.delete(audio);
  }
}

function fadeAudio(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  onComplete?: () => void
) {
  clearFadeTimer(audio);

  const steps = Math.max(1, Math.round(FADE_DURATION_MS / FADE_INTERVAL_MS));
  let step = 0;
  audio.volume = from;

  const timer = window.setInterval(() => {
    step += 1;
    const progress = Math.min(1, step / steps);
    audio.volume = from + (to - from) * progress;

    if (progress >= 1) {
      clearFadeTimer(audio);
      onComplete?.();
    }
  }, FADE_INTERVAL_MS);
  fadeTimers.set(audio, timer);
}

function removeUnlockListeners() {
  if (!unlockListenersAttached) {
    return;
  }

  document.removeEventListener('pointerdown', handleUserUnlock);
  document.removeEventListener('keydown', handleUserUnlock);
  unlockListenersAttached = false;
}

function ensureUnlockListeners() {
  if (unlockListenersAttached) {
    return;
  }

  document.addEventListener('pointerdown', handleUserUnlock);
  document.addEventListener('keydown', handleUserUnlock);
  unlockListenersAttached = true;
}

function playWithFallback(audio: HTMLAudioElement) {
  void audio.play().then(removeUnlockListeners).catch(() => {
    ensureUnlockListeners();
  });
}

function swapTrack(nextTrack: string, volume: number) {
  if (!nextTrack) {
    if (!currentAudio) {
      return;
    }

    const audioToStop = currentAudio;
    currentAudio = null;
    currentTrack = '';
    fadeAudio(audioToStop, audioToStop.volume, 0, () => {
      audioToStop.pause();
      audioToStop.currentTime = 0;
    });
    return;
  }

  if (currentAudio && currentTrack === nextTrack) {
    currentVolume = volume;
    fadeAudio(currentAudio, currentAudio.volume, volume);
    playWithFallback(currentAudio);
    return;
  }

  const nextAudio = new Audio(nextTrack);
  nextAudio.loop = true;
  nextAudio.preload = 'auto';
  nextAudio.volume = 0;

  const previousAudio = currentAudio;
  currentAudio = nextAudio;
  currentTrack = nextTrack;
  currentVolume = volume;

  playWithFallback(nextAudio);
  fadeAudio(nextAudio, 0, volume);

  if (previousAudio) {
    const audioToStop = previousAudio;
    const startVolume = audioToStop.volume;
    window.setTimeout(() => {
      fadeAudio(audioToStop, startVolume, 0, () => {
        audioToStop.pause();
        audioToStop.currentTime = 0;
      });
    }, 0);
  }
}

function handleUserUnlock() {
  if (!currentAudio) {
    return;
  }

  playWithFallback(currentAudio);
}

function handleVisibilityChange() {
  if (!currentAudio) {
    return;
  }

  if (document.hidden) {
    fadeAudio(currentAudio, currentAudio.volume, 0, () => {
      currentAudio?.pause();
    });
    return;
  }

  currentAudio.volume = 0;
  playWithFallback(currentAudio);
  fadeAudio(currentAudio, 0, currentVolume);
}

function ensureVisibilityListener() {
  if (visibilityListenerAttached) {
    return;
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerAttached = true;
}

export function useBackgroundMusic(track: string, volume: number) {
  const musicVolume = useAudioSettingsStore((state) => state.musicVolume);

  useEffect(() => {
    ensureVisibilityListener();
    swapTrack(track, volume * musicVolume);
  }, [track, volume, musicVolume]);
}
