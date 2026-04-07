import { useGameStore } from '../store/game';
import {
  Position,
  GamePhase,
  CellState,
  PowerType,
  GameLog,
  GameState,
  ACTION_NONE,
  ACTION_DIG,
  ACTION_DETECTOR,
  ACTION_COMPASS,
  GRID_SIZE,
} from '../types/game';

// Re-export types and constants for backwards compatibility
export type { Position, GamePhase, CellState, PowerType, GameLog, GameState };
export { ACTION_NONE, ACTION_DIG, ACTION_DETECTOR, ACTION_COMPASS, GRID_SIZE };

export function useGame() {
  const store = useGameStore();

  // Return the same interface as before for backwards compatibility
  return {
    // State
    gameId: store.gameId,
    gamePhase: store.gamePhase,
    isPlayer1: store.isPlayer1,
    isMyTurn: store.isMyTurn,
    myScore: store.myScore,
    opponentScore: store.opponentScore,
    winner: store.winner,
    pendingAction: store.pendingAction,
    mySetupDone: store.mySetupDone,
    selectedTreasures: store.selectedTreasures,
    myTreasurePositions: store.myTreasurePositions,
    dugCells: store.dugCells,
    diggingCell: store.diggingCell,
    activeAction: store.activeAction,
    selectedAction: store.selectedAction,
    isLoading: store.isLoading,
    statusMessage: store.statusMessage,
    error: store.error,
    logs: store.logs,
    powers: store.powers,
    scannedArea: store.scannedArea,
    lastCompassDistance: store.lastCompassDistance,
    lastCompassPosition: store.lastCompassPosition,
    compassResult: store.compassResult,
    shovelSourcePosition: store.shovelSourcePosition,
    myTrapPositions: store.myTrapPositions,
    hasExtraTurn: store.hasExtraTurn,

    // Actions
    createGame: store.createGame,
    joinGame: store.joinGame,
    placeTreasures: store.placeTreasures,
    dig: store.dig,
    respondDig: store.respondDig,
    useDetector: store.useDetector,
    respondDetector: store.respondDetector,
    useCompass: store.useCompass,
    respondCompass: store.respondCompass,
    useShovel: store.useShovel,
    setShovelSource: store.setShovelSource,
    useTrap: store.useTrap,
    toggleTreasure: store.toggleTreasure,
    clearSelectedTreasures: store.clearSelectedTreasures,
    setSelectedAction: store.setSelectedAction,
    refreshGameState: store.refreshGameState,
    resetGame: store.resetGame,
    setError: store.setError,
    setGameId: store.setGameId,
  };
}
