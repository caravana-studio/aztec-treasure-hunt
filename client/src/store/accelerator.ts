import { create } from 'zustand';

export type AcceleratorMode = 'accelerated' | 'wasm';

export type AcceleratorPhaseLabel =
  | 'detect'
  | 'transmit'
  | 'proving'
  | 'proved'
  | 'receive'
  | 'fallback'
  | 'denied'
  | null;

interface AcceleratorStore {
  /** Whether the native desktop accelerator is reachable */
  available: boolean;
  /** Current mode — can be forced to wasm even when native is available */
  mode: AcceleratorMode;
  /** Current proving phase, null when idle */
  phase: AcceleratorPhaseLabel;
  /** Last proof duration in ms */
  lastProofMs: number | null;

  setAvailable: (available: boolean) => void;
  setMode: (mode: AcceleratorMode) => void;
  setPhase: (phase: AcceleratorPhaseLabel) => void;
  setLastProofMs: (ms: number) => void;
}

export const useAcceleratorStore = create<AcceleratorStore>((set) => ({
  available: false,
  mode: 'accelerated',
  phase: null,
  lastProofMs: null,

  setAvailable: (available) => set({ available }),
  setMode: (mode) => set({ mode }),
  setPhase: (phase) => set({ phase }),
  setLastProofMs: (ms) => set({ lastProofMs: ms }),
}));
