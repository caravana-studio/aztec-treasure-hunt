import { create } from 'zustand';
import { Fr } from '@aztec/aztec.js/fields';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { useWalletStore } from '../wallet/walletStore';
import {
  GameState,
  GamePhase,
  PowerType,
  Position,
  DugCell,
  GameLog,
  INITIAL_POWERS,
  ACTION_NONE,
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
  selectedTreasures: [],
  myTreasurePositions: [],
  dugCells: [],
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
    const { gameId: stateGameId, addLog } = get();
    const gameIdToUse = gameIdOverride || stateGameId;

    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameIdToUse) {
      return;
    }

    try {
      set({ isLoading: true, statusMessage: 'Refreshing...' });

      const contract = TreasureHuntContract.at(contractAddress, wallet);

      const status = await contract.methods.get_game_status(gameIdToUse).simulate({ from: myAddress });
      const player1 = await contract.methods.get_player1(gameIdToUse).simulate({ from: myAddress });
      const p1Score = await contract.methods.get_player1_treasures_found(gameIdToUse).simulate({ from: myAddress });
      const p2Score = await contract.methods.get_player2_treasures_found(gameIdToUse).simulate({ from: myAddress });
      const currentTurn = await contract.methods.get_current_turn(gameIdToUse).simulate({ from: myAddress });
      const pendingResult = await contract.methods.get_pending_action(gameIdToUse).simulate({ from: myAddress });
      const pendingActionType = BigInt(pendingResult[0]);

      const isP1 = player1.toString() === myAddress.toString();
      const myTurn = currentTurn.toString() === myAddress.toString();

      let gamePhase: GamePhase = 'lobby';
      let winner: string | null = null;

      if (status === STATUS_CREATED) {
        gamePhase = 'lobby';
      } else if (status === STATUS_SETUP) {
        gamePhase = 'setup';
      } else if (status === STATUS_PLAYING) {
        gamePhase = 'playing';
      } else if (status === STATUS_AWAITING) {
        gamePhase = 'awaiting';
      } else if (status === STATUS_FINISHED) {
        gamePhase = 'finished';
        const w = await contract.methods.get_winner(gameIdToUse).simulate({ from: myAddress });
        winner = w.toString() === myAddress.toString() ? 'You Win!' : 'You Lose!';
      }

      // Fetch real power counts for the player
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

      // Fetch dig results
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

      set({
        isPlayer1: isP1,
        isMyTurn: myTurn,
        myScore: Number(isP1 ? p1Score : p2Score),
        opponentScore: Number(isP1 ? p2Score : p1Score),
        pendingAction: pendingActionType,
        gamePhase,
        winner,
        powers,
        dugCells,
        isLoading: false,
        statusMessage: '',
      });
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

      addLog(`Game #${nextGameId.toString()} created. Waiting for opponent...`);
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

      addLog(`Joined game ${gameIdStr}. Place your treasures!`);
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

      addLog('Treasures placed!');
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

    set({ isLoading: true, statusMessage: 'Digging...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.dig(gameId, x, y).send({ from: myAddress }).wait();

      addLog(`Dug at position (${x}, ${y})`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to dig - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to dig', isLoading: false });
    }
  },

  respondDig: async () => {
    const { gameId, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Checking dig result...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const pendingResult = await contract.methods.get_pending_action(gameId).simulate({ from: myAddress });
      const pendingX = Number(pendingResult[1]);
      const pendingY = Number(pendingResult[2]);

      console.log('Responding to dig at:', pendingX, pendingY);

      await contract.methods.check_dig_result(gameId, pendingX, pendingY).send({ from: myAddress }).wait();

      addLog(`Responded to dig at (${pendingX}, ${pendingY})`);
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
