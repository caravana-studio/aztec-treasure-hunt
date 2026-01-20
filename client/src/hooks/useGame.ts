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
    selectedAction: store.selectedAction,
    isLoading: store.isLoading,
    statusMessage: store.statusMessage,
    error: store.error,
    logs: store.logs,
    powers: store.powers,

    // Actions
    createGame: store.createGame,
    joinGame: store.joinGame,
    placeTreasures: store.placeTreasures,
    dig: store.dig,
    respondDig: store.respondDig,
    toggleTreasure: store.toggleTreasure,
    setSelectedAction: store.setSelectedAction,
    refreshGameState: store.refreshGameState,
    resetGame: store.resetGame,
    setError: store.setError,
    setGameId: store.setGameId,
  };
}
