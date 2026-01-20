import { create } from 'zustand';
import { Fr } from '@aztec/aztec.js/fields';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { useWalletStore } from '../wallet/walletStore';
import {
  GameState,
  GamePhase,
  PowerType,
  DugCell,
  INITIAL_POWERS,
  ACTION_NONE,
  ACTION_DIG,
  STATUS_CREATED,
  STATUS_SETUP,
  STATUS_PLAYING,
  STATUS_AWAITING,
  STATUS_FINISHED,
} from '../../types/game';

// Helper to extract error message from various error types
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as unknown as Record<string, unknown>;
    if (typeof anyErr.reason === 'string' && anyErr.reason) {
      return anyErr.reason;
    }
    if (typeof anyErr.cause === 'string' && anyErr.cause) {
      return anyErr.cause;
    }
    if (err.message) {
      return err.message;
    }
  }
  if (typeof err === 'string') {
    return err;
  }
  return JSON.stringify(err);
}

interface GameActions {
  // Game lifecycle
  createGame: () => Promise<number | null>;
  joinGame: (gameIdStr: string) => Promise<Fr | null>;
  refreshGameState: (gameIdOverride?: Fr) => Promise<void>;
  resetGame: () => void;

  // Game actions
  placeTreasures: () => Promise<void>;
  dig: (x: number, y: number) => Promise<void>;
  respondDig: () => Promise<void>;

  // UI state
  toggleTreasure: (x: number, y: number) => void;
  setSelectedAction: (action: PowerType) => void;
  setGameId: (gameId: Fr) => void;
  setError: (error: string | null) => void;
  addLog: (message: string) => void;
}

type GameStore = GameState & GameActions;

const initialState: GameState = {
  gameId: null,
  gamePhase: 'lobby',
  isPlayer1: false,
  isMyTurn: false,
  myScore: 0,
  opponentScore: 0,
  winner: null,
  pendingAction: ACTION_NONE,
  pendingX: 0,
  pendingY: 0,
  mySetupDone: false,
  selectedTreasures: [],
  myTreasurePositions: [],
  dugCells: [],
  diggingCell: null,
  selectedAction: 'dig',
  isLoading: false,
  statusMessage: '',
  error: null,
  logs: [],
  powers: { ...INITIAL_POWERS },
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  addLog: (message: string) => {
    set((state) => ({
      logs: [
        { id: Date.now(), message, timestamp: new Date() },
        ...state.logs.slice(0, 49),
      ],
    }));
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setGameId: (gameId: Fr) => {
    set({ gameId });
  },

  setSelectedAction: (action: PowerType) => {
    set({ selectedAction: action });
  },

  toggleTreasure: (x: number, y: number) => {
    set((state) => {
      const idx = state.selectedTreasures.findIndex((t) => t.x === x && t.y === y);
      if (idx >= 0) {
        return {
          selectedTreasures: state.selectedTreasures.filter((_, i) => i !== idx),
        };
      } else if (state.selectedTreasures.length < 3) {
        return {
          selectedTreasures: [...state.selectedTreasures, { x, y }],
        };
      }
      return state;
    });
  },

  resetGame: () => {
    set(initialState);
  },

  refreshGameState: async (gameIdOverride?: Fr) => {
    const { gameId: stateGameId } = get();
    const gameIdToUse = gameIdOverride || stateGameId;

    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameIdToUse) {
      return;
    }

    try {
      set({ isLoading: true, statusMessage: 'Refreshing...' });

      const contract = TreasureHuntContract.at(contractAddress, wallet);

      // Use get_game to fetch all public game state in a single call
      const game = await contract.methods.get_game(gameIdToUse).simulate({ from: myAddress });

      const status = BigInt(game.status);
      const isP1 = game.player1.toString() === myAddress.toString();
      const myTurn = game.current_turn.toString() === myAddress.toString();
      const pendingActionType = BigInt(game.pending_action);
      const pendingX = Number(game.pending_x);
      const pendingY = Number(game.pending_y);
      const p1Score = Number(game.player1_found);
      const p2Score = Number(game.player2_found);
      const mySetupDone = isP1 ? game.player1_setup_done : game.player2_setup_done;

      let gamePhase: GamePhase = 'lobby';
      let winner: string | null = null;

      const { gamePhase: previousPhase, addLog: logPhaseChange } = get();

      if (status === STATUS_CREATED) {
        gamePhase = 'lobby';
      } else if (status === STATUS_SETUP) {
        gamePhase = 'setup';
        if (previousPhase === 'lobby') {
          logPhaseChange('👋 Opponent joined! Both players place your treasures');
        }
      } else if (status === STATUS_PLAYING) {
        gamePhase = 'playing';
        if (previousPhase === 'setup') {
          logPhaseChange('⚔️ Game started! Take turns to find opponent\'s treasures');
        }
      } else if (status === STATUS_AWAITING) {
        gamePhase = 'awaiting';
      } else if (status === STATUS_FINISHED) {
        gamePhase = 'finished';
        winner = game.winner.toString() === myAddress.toString() ? 'You Win!' : 'You Lose!';
        if (previousPhase !== 'finished') {
          logPhaseChange(winner === 'You Win!' ? '🏆 Victory! You found all treasures!' : '😢 Defeat! Opponent found all treasures');
        }
      }

      // Fetch real power counts for the player (private data, still needs separate call)
      let powers = { ...INITIAL_POWERS };
      if (status !== STATUS_CREATED) {
        try {
          const myPowers = await contract.methods.get_my_powers(gameIdToUse, myAddress).simulate({ from: myAddress });
          powers = {
            dig: 999,
            detector: Number(myPowers[0]),
            compass: Number(myPowers[1]),
            shovel: Number(myPowers[2]),
            trap: Number(myPowers[3]),
          };
        } catch (err) {
          console.error('Failed to fetch powers:', err);
        }
      }

      // Fetch dig results (still needs separate call)
      let dugCells: DugCell[] = [];
      if (status === STATUS_PLAYING || status === STATUS_AWAITING || status === STATUS_FINISHED) {
        try {
          const digResults = await contract.methods.get_all_dig_results(gameIdToUse).simulate({ from: myAddress });
          for (let i = 0; i < 64; i++) {
            const result = Number(digResults[i]);
            if (result > 0) {
              const x = i % 8;
              const y = Math.floor(i / 8);
              const digger = Math.floor(result / 4);
              const resultType = result % 4;
              const isMine = (isP1 && digger === 1) || (!isP1 && digger === 2);
              dugCells.push({ x, y, found: resultType === 2, isMine });
            }
          }
        } catch (err) {
          console.error('Failed to fetch dig results:', err);
        }
      }

      // Clear diggingCell when the dig action is complete (no longer awaiting)
      const { diggingCell: currentDiggingCell, dugCells: previousDugCells, addLog } = get();
      const shouldClearDiggingCell = currentDiggingCell && (
        gamePhase !== 'awaiting' || pendingActionType === ACTION_NONE
      );

      // Detect new dig results and log them
      for (const cell of dugCells) {
        const wasAlreadyDug = previousDugCells.some(
          (prev) => prev.x === cell.x && prev.y === cell.y
        );
        if (!wasAlreadyDug) {
          const who = cell.isMine ? 'You' : 'Opponent';
          if (cell.found) {
            addLog(`${who} found a treasure at (${cell.x}, ${cell.y})!`);
          } else {
            addLog(`${who} found nothing at (${cell.x}, ${cell.y})`);
          }
        }
      }

      set({
        isPlayer1: isP1,
        isMyTurn: myTurn,
        myScore: isP1 ? p1Score : p2Score,
        opponentScore: isP1 ? p2Score : p1Score,
        pendingAction: pendingActionType,
        pendingX,
        pendingY,
        mySetupDone,
        gamePhase,
        winner,
        powers,
        dugCells,
        isLoading: false,
        statusMessage: '',
        ...(shouldClearDiggingCell && { diggingCell: null }),
      });

      // Auto-respond to pending actions if needed
      // When game is awaiting and it's NOT my turn, I need to respond
      if (gamePhase === 'awaiting' && !myTurn && pendingActionType === ACTION_DIG) {
        console.log('Auto-responding to dig action...');
        // Use setTimeout to avoid blocking and ensure state is updated first
        setTimeout(() => {
          const { respondDig } = get();
          respondDig();
        }, 100);
      }

      // Auto-poll when waiting for opponent's response
      // When game is awaiting and it IS my turn, the opponent needs to respond
      if (gamePhase === 'awaiting' && myTurn && pendingActionType !== ACTION_NONE) {
        console.log('Waiting for opponent response, will auto-refresh in 3s...');
        setTimeout(() => {
          const { refreshGameState, isLoading } = get();
          // Only refresh if not already loading
          if (!isLoading) {
            refreshGameState();
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to refresh game state:', err);
      set({ isLoading: false });
    }
  },

  createGame: async () => {
    const { addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress) {
      return null;
    }

    set({ isLoading: true, statusMessage: 'Creating game...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const nextGameId = await contract.methods.get_next_game_id().simulate({ from: myAddress });
      const id = new Fr(nextGameId);

      await contract.methods.create_game().send({ from: myAddress }).wait();

      set({ gameId: id, isPlayer1: true });

      addLog(`Game #${nextGameId.toString()} created! Share this ID with your opponent`);
      await refreshGameState(id);

      return typeof nextGameId === 'bigint' ? Number(nextGameId) : nextGameId;
    } catch (err: unknown) {
      console.error('Failed to create game - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to create game', isLoading: false });
      return null;
    }
  },

  joinGame: async (gameIdStr: string) => {
    const { addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameIdStr) {
      return null;
    }

    set({ isLoading: true, statusMessage: 'Joining game...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const id = new Fr(Number(gameIdStr));
      await contract.methods.join_game(id).send({ from: myAddress }).wait();

      set({ gameId: id, isPlayer1: false });

      addLog(`Joined game #${gameIdStr}! Place your 3 treasures on the grid`);
      await refreshGameState(id);

      return id;
    } catch (err: unknown) {
      console.error('Failed to join game - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to join game', isLoading: false });
      return null;
    }
  },

  placeTreasures: async () => {
    const { gameId, selectedTreasures, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId || selectedTreasures.length !== 3) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Placing treasures...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const [t1, t2, t3] = selectedTreasures;
      await contract.methods
        .place_treasures(gameId, t1.x, t1.y, t2.x, t2.y, t3.x, t3.y)
        .send({ from: myAddress })
        .wait();

      set((state) => ({ myTreasurePositions: [...state.selectedTreasures] }));

      addLog('Your treasures are now hidden!');
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to place treasures - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to place treasures', isLoading: false });
    }
  },

  dig: async (x: number, y: number) => {
    const { gameId, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Digging...', diggingCell: { x, y } });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.dig(gameId, x, y).send({ from: myAddress }).wait();

      addLog(`You dig at (${x}, ${y})...`);
      // Don't clear diggingCell here - keep animation until opponent responds
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to dig - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to dig', isLoading: false, diggingCell: null });
    }
  },

  respondDig: async () => {
    const { gameId, pendingX, pendingY, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Checking dig result...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);

      console.log('Responding to dig at:', pendingX, pendingY);

      await contract.methods.check_dig_result(gameId, pendingX, pendingY).send({ from: myAddress }).wait();

      addLog(`Opponent digs at (${pendingX}, ${pendingY})...`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to respond - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to respond', isLoading: false });
    }
  },
}));

// Selector hooks
export const useGameId = () => useGameStore((state) => state.gameId);
export const useGamePhase = () => useGameStore((state) => state.gamePhase);
export const useIsMyTurn = () => useGameStore((state) => state.isMyTurn);
export const useGameLoading = () => useGameStore((state) => ({ isLoading: state.isLoading, statusMessage: state.statusMessage }));
export const useGameError = () => useGameStore((state) => state.error);
export const useGameLogs = () => useGameStore((state) => state.logs);
export const usePowers = () => useGameStore((state) => state.powers);
export const useScores = () => useGameStore((state) => ({ myScore: state.myScore, opponentScore: state.opponentScore }));
