import { create } from 'zustand';

export type AcceleratorMode = 'accelerated' | 'wasm';

export type AcceleratorPhaseLabel =
  | 'detect'
  | 'serialize'
  | 'transmit'
  | 'proving'
  | 'proved'
  | 'receive'
  | 'downloading'
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
  /** Monotonic counter incremented when a proof completes */
  proofSequence: number;

  setAvailable: (available: boolean) => void;
  setMode: (mode: AcceleratorMode) => void;
  setPhase: (phase: AcceleratorPhaseLabel) => void;
  setLastProofMs: (ms: number) => void;
  bumpProofSequence: () => void;
}

export const useAcceleratorStore = create<AcceleratorStore>((set) => ({
  available: false,
  mode: 'accelerated',
  phase: null,
  lastProofMs: null,
  proofSequence: 0,

  setAvailable: (available) => set({ available }),
  setMode: (mode) => set({ mode }),
  setPhase: (phase) => set({ phase }),
  setLastProofMs: (ms) => set({ lastProofMs: ms }),
  bumpProofSequence: () => set((state) => ({ proofSequence: state.proofSequence + 1 })),
}));
