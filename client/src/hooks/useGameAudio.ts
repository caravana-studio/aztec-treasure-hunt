import { useEffect, useRef } from 'react';
import type { ActiveAction, DugCell, GamePhase } from '../types/game';

type SoundEffectName =
  | 'treasureSelect'
  | 'treasureFound'
  | 'dig'
  | 'radar'
  | 'trap'
  | 'trapActivated'
  | 'compass';

interface UseGameAudioOptions {
  enabled: boolean;
  resetKey: string;
  gamePhase: GamePhase;
  selectedTreasureCount: number;
  activeAction: ActiveAction | null;
  dugCells: DugCell[];
}

const SOUND_FILES: Record<SoundEffectName, string> = {
  treasureSelect: '/sounds/treasure.mp3',
  treasureFound: '/sounds/treasure_founded.mp3',
  dig: '/sounds/dig.mp3',
  radar: '/sounds/radar.mp3',
  trap: '/sounds/trap.mp3',
  trapActivated: '/sounds/trap_activated.mp3',
  compass: '/sounds/compass.mp3',
};

const SOUND_VOLUMES: Record<SoundEffectName, number> = {
  treasureSelect: 0.58,
  treasureFound: 0.78,
  dig: 0.72,
  radar: 0.7,
  trap: 0.72,
  trapActivated: 0.78,
  compass: 0.72,
};

function getDugCellKey(cell: DugCell) {
  return `${cell.x}:${cell.y}:${cell.found ? 'found' : 'empty'}:${cell.hitTrap ? 'trap' : 'safe'}:${cell.isMine ? 'me' : 'them'}`;
}

function getActionKey(action: ActiveAction | null) {
  if (!action) {
    return '';
  }
  return `${action.type}:${action.position.x}:${action.position.y}`;
}

export function useGameAudio({
  enabled,
  resetKey,
  gamePhase,
  selectedTreasureCount,
  activeAction,
  dugCells,
}: UseGameAudioOptions) {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const effectTemplatesRef = useRef<Record<SoundEffectName, HTMLAudioElement> | null>(null);
  const previousTreasureCountRef = useRef(selectedTreasureCount);
  const previousActionKeyRef = useRef(getActionKey(activeAction));
  const previousDugKeysRef = useRef(new Set(dugCells.map(getDugCellKey)));

  const playEffect = (name: SoundEffectName) => {
    const template = effectTemplatesRef.current?.[name];
    if (!template) {
      return;
    }

    const instance = template.cloneNode() as HTMLAudioElement;
    instance.volume = template.volume;
    instance.currentTime = 0;
    void instance.play().catch(() => {});
  };

  useEffect(() => {
    previousTreasureCountRef.current = selectedTreasureCount;
    previousActionKeyRef.current = getActionKey(activeAction);
    previousDugKeysRef.current = new Set(dugCells.map(getDugCellKey));
  }, [enabled, resetKey, selectedTreasureCount, activeAction, dugCells]);

  useEffect(() => {
    if (!enabled) {
      musicRef.current?.pause();
      musicRef.current = null;
      effectTemplatesRef.current = null;
      return;
    }

    const music = new Audio('/sounds/game_music.mp3');
    music.loop = true;
    music.volume = 0.22;
    music.preload = 'auto';
    musicRef.current = music;

    const templates = Object.fromEntries(
      Object.entries(SOUND_FILES).map(([name, src]) => {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = SOUND_VOLUMES[name as SoundEffectName];
        return [name, audio];
      })
    ) as Record<SoundEffectName, HTMLAudioElement>;
    effectTemplatesRef.current = templates;

    const removeUnlockListeners = () => {
      document.removeEventListener('pointerdown', unlockMusic);
      document.removeEventListener('keydown', unlockMusic);
    };

    const startMusic = () => {
      void music.play().then(removeUnlockListeners).catch(() => {});
    };

    const unlockMusic = () => {
      startMusic();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        music.pause();
      } else {
        startMusic();
      }
    };

    startMusic();
    document.addEventListener('pointerdown', unlockMusic);
    document.addEventListener('keydown', unlockMusic);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      removeUnlockListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      music.pause();
      music.currentTime = 0;
      musicRef.current = null;
      effectTemplatesRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || gamePhase !== 'setup') {
      previousTreasureCountRef.current = selectedTreasureCount;
      return;
    }

    if (selectedTreasureCount > previousTreasureCountRef.current) {
      playEffect('treasureSelect');
    }

    previousTreasureCountRef.current = selectedTreasureCount;
  }, [enabled, gamePhase, selectedTreasureCount]);

  useEffect(() => {
    if (!enabled) {
      previousActionKeyRef.current = getActionKey(activeAction);
      return;
    }

    const nextActionKey = getActionKey(activeAction);
    if (!nextActionKey) {
      previousActionKeyRef.current = '';
      return;
    }

    if (nextActionKey !== previousActionKeyRef.current && activeAction) {
      if (activeAction.type === 'dig') {
        playEffect('dig');
      } else if (activeAction.type === 'detector') {
        playEffect('radar');
      } else if (activeAction.type === 'compass') {
        playEffect('compass');
      } else if (activeAction.type === 'trap') {
        playEffect('trap');
      }
    }

    previousActionKeyRef.current = nextActionKey;
  }, [enabled, activeAction]);

  useEffect(() => {
    if (!enabled) {
      previousDugKeysRef.current = new Set(dugCells.map(getDugCellKey));
      return;
    }

    const previousKeys = previousDugKeysRef.current;
    const nextKeys = new Set<string>();
    let shouldPlayTrapActivated = false;
    let shouldPlayTreasureFound = false;

    for (const cell of dugCells) {
      const key = getDugCellKey(cell);
      nextKeys.add(key);

      if (!previousKeys.has(key)) {
        if (cell.hitTrap) {
          shouldPlayTrapActivated = true;
        } else if (cell.found && cell.isMine) {
          shouldPlayTreasureFound = true;
        }
      }
    }

    if (shouldPlayTrapActivated) {
      playEffect('trapActivated');
    } else if (shouldPlayTreasureFound) {
      playEffect('treasureFound');
    }

    previousDugKeysRef.current = nextKeys;
  }, [enabled, dugCells]);
}
