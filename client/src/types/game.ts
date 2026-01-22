import { Fr } from '@aztec/aztec.js/fields';

export type Position = { x: number; y: number };
export type GamePhase = 'lobby' | 'setup' | 'playing' | 'awaiting' | 'finished';
export type CellState = 'normal' | 'your-treasure' | 'dug-empty' | 'dug-found' | 'selected';
export type PowerType = 'dig' | 'shovel' | 'detector' | 'compass' | 'trap';

export interface GameLog {
  id: number;
  message: string;
  timestamp: Date;
}

export interface DugCell extends Position {
  found: boolean;
  isMine: boolean;
}

export interface ScannedArea {
  center: Position;
  cells: Position[];
  result: number;
}

export interface CompassResult {
  position: Position;
  distance: number;
}

export interface Powers {
  dig: number;
  detector: number;
  compass: number;
  shovel: number;
  trap: number;
}

export interface ActiveAction {
  type: PowerType;
  position: Position;
}

export interface GameState {
  gameId: Fr | null;
  gamePhase: GamePhase;
  isPlayer1: boolean;
  isMyTurn: boolean;
  myScore: number;
  opponentScore: number;
  winner: string | null;
  pendingAction: bigint;
  pendingX: number;
  pendingY: number;
  mySetupDone: boolean;
  selectedTreasures: Position[];
  myTreasurePositions: Position[];
  dugCells: DugCell[];
  diggingCell: Position | null;
  activeAction: ActiveAction | null;
  selectedAction: PowerType;
  isLoading: boolean;
  statusMessage: string;
  error: string | null;
  logs: GameLog[];
  powers: Powers;
  lastDetectorCount: number;
  lastDetectorPosition: Position | null;
  scannedArea: ScannedArea | null;
  lastCompassDistance: number | null;
  lastCompassPosition: Position | null;
  compassResult: CompassResult | null;
  // Shovel state for two-step selection
  shovelSourcePosition: Position | null;
}

// Game status constants
export const STATUS_CREATED = 0n;
export const STATUS_SETUP = 1n;
export const STATUS_PLAYING = 2n;
export const STATUS_AWAITING = 3n;
export const STATUS_FINISHED = 4n;

// Pending action types
export const ACTION_NONE = 0n;
export const ACTION_DIG = 1n;
export const ACTION_DETECTOR = 2n;
export const ACTION_COMPASS = 3n;

export const GRID_SIZE = 8;

export const INITIAL_POWERS: Powers = {
  dig: 999,
  detector: 3,
  compass: 2,
  shovel: 1,
  trap: 2,
};
