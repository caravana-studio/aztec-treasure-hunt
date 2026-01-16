import { useState, useCallback } from 'react';
import { Fr } from '@aztec/aztec.js/fields';
import { TreasureHuntContract } from '../artifacts/TreasureHunt';
import { useWallet } from '../context/WalletContext';

// Game status constants
const STATUS_CREATED = 0n;
const STATUS_SETUP = 1n;
const STATUS_PLAYING = 2n;
const STATUS_AWAITING = 3n;
const STATUS_FINISHED = 4n;

// Pending action types
export const ACTION_NONE = 0n;
export const ACTION_DIG = 1n;
export const ACTION_DETECTOR = 2n;
export const ACTION_COMPASS = 3n;

export const GRID_SIZE = 8;

export type Position = { x: number; y: number };
export type GamePhase = 'lobby' | 'setup' | 'playing' | 'awaiting' | 'finished';
export type CellState = 'normal' | 'your-treasure' | 'dug-empty' | 'dug-found' | 'selected';
export type PowerType = 'dig' | 'shovel' | 'detector' | 'compass' | 'trap';

export interface GameLog {
  id: number;
  message: string;
  timestamp: Date;
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
  selectedTreasures: Position[];
  myTreasurePositions: Position[];
  dugCells: (Position & { found: boolean })[];
  selectedAction: PowerType;
  isLoading: boolean;
  statusMessage: string;
  error: string | null;
  logs: GameLog[];
  powers: Record<PowerType, number>;
}

const initialPowers: Record<PowerType, number> = {
  dig: 999, // dig is unlimited
  detector: 3,
  compass: 2,
  shovel: 1,
  trap: 2,
};

// Helper to extract error message from various error types
function extractErrorMessage(err: unknown): string {
  console.log('Error object keys:', err ? Object.keys(err as object) : 'null');

  if (err instanceof Error) {
    // Check for nested cause or reason
    const anyErr = err as Record<string, unknown>;
    if (anyErr.cause) {
      console.log('Error cause:', anyErr.cause);
    }
    if (anyErr.reason) {
      console.log('Error reason:', anyErr.reason);
    }
    if (anyErr.data) {
      console.log('Error data:', anyErr.data);
    }

    // Try to extract a meaningful message
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

export function useGame() {
  const { wallet, myAddress, contractAddress } = useWallet();

  const [state, setState] = useState<GameState>({
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
    powers: { ...initialPowers },
  });

  const addLog = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      logs: [
        { id: Date.now(), message, timestamp: new Date() },
        ...prev.logs.slice(0, 49),
      ],
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((isLoading: boolean, statusMessage = '') => {
    setState((prev) => ({ ...prev, isLoading, statusMessage }));
  }, []);

  const refreshGameState = useCallback(
    async (gameIdOverride?: Fr) => {
      const gameIdToUse = gameIdOverride || state.gameId;
      if (!wallet || !myAddress || !contractAddress || !gameIdToUse) return;

      try {
        setLoading(true, 'Refreshing...');
        const contract = TreasureHuntContract.at(contractAddress, wallet);

        const status = await contract.methods.get_game_status(gameIdToUse).simulate({ from: myAddress });
        const player1 = await contract.methods.get_player1(gameIdToUse).simulate({ from: myAddress });
        const p1Score = await contract.methods.get_player1_treasures_found(gameIdToUse).simulate({ from: myAddress });
        const p2Score = await contract.methods.get_player2_treasures_found(gameIdToUse).simulate({ from: myAddress });
        const currentTurn = await contract.methods.get_current_turn(gameIdToUse).simulate({ from: myAddress });
        const pending = await contract.methods.get_pending_action(gameIdToUse).simulate({ from: myAddress });

        const isP1 = player1.toString() === myAddress.toString();
        const myTurn = (currentTurn === 1n && isP1) || (currentTurn === 2n && !isP1);

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
        let powers = { ...initialPowers };
        if (status !== STATUS_CREATED) {
          try {
            const myPowers = await contract.methods.get_my_powers(gameIdToUse, myAddress).simulate({ from: myAddress });
            // Returns (detector_count, compass_count, shovel_count, trap_count)
            powers = {
              dig: 999, // dig is unlimited
              detector: Number(myPowers[0]),
              compass: Number(myPowers[1]),
              shovel: Number(myPowers[2]),
              trap: Number(myPowers[3]),
            };
          } catch (err) {
            console.error('Failed to fetch powers:', err);
          }
        }

        setState((prev) => ({
          ...prev,
          isPlayer1: isP1,
          isMyTurn: myTurn,
          myScore: Number(isP1 ? p1Score : p2Score),
          opponentScore: Number(isP1 ? p2Score : p1Score),
          pendingAction: pending,
          gamePhase,
          winner,
          powers,
          isLoading: false,
          statusMessage: '',
        }));
      } catch (err) {
        console.error('Failed to refresh game state:', err);
        setLoading(false);
      }
    },
    [wallet, myAddress, contractAddress, state.gameId, setLoading]
  );

  const createGame = useCallback(
    async () => {
      if (!wallet || !myAddress || !contractAddress) return;

      setLoading(true, 'Creating game...');
      setError(null);

      try {
        const contract = TreasureHuntContract.at(contractAddress, wallet);

        // Get the next game ID that will be assigned
        const nextGameId = await contract.methods.get_next_game_id().simulate({ from: myAddress });
        const id = new Fr(nextGameId);

        // Create game (ID is auto-assigned)
        await contract.methods.create_game().send({ from: myAddress }).wait();

        setState((prev) => ({
          ...prev,
          gameId: id,
          isPlayer1: true,
        }));

        addLog(`Game #${nextGameId.toString()} created. Waiting for opponent...`);
        await refreshGameState(id);
        return id;
      } catch (err: unknown) {
        console.error('Failed to create game - Full error:', err);
        const errorMessage = extractErrorMessage(err);
        setError(errorMessage || 'Failed to create game');
        setLoading(false);
        return null;
      }
    },
    [wallet, myAddress, contractAddress, setLoading, setError, addLog, refreshGameState]
  );

  const joinGame = useCallback(
    async (gameIdStr: string) => {
      if (!wallet || !myAddress || !contractAddress || !gameIdStr) return;

      setLoading(true, 'Joining game...');
      setError(null);

      try {
        const contract = TreasureHuntContract.at(contractAddress, wallet);
        const id = new Fr(Number(gameIdStr));
        await contract.methods.join_game(id).send({ from: myAddress }).wait();

        setState((prev) => ({
          ...prev,
          gameId: id,
          isPlayer1: false,
        }));

        addLog(`Joined game ${gameIdStr}. Place your treasures!`);
        await refreshGameState(id);
        return id;
      } catch (err: unknown) {
        console.error('Failed to join game - Full error:', err);
        const errorMessage = extractErrorMessage(err);
        setError(errorMessage || 'Failed to join game');
        setLoading(false);
        return null;
      }
    },
    [wallet, myAddress, contractAddress, setLoading, setError, addLog, refreshGameState]
  );

  const placeTreasures = useCallback(async () => {
    if (!wallet || !myAddress || !contractAddress || !state.gameId || state.selectedTreasures.length !== 3) return;

    setLoading(true, 'Placing treasures...');
    setError(null);

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const [t1, t2, t3] = state.selectedTreasures;
      await contract.methods
        .place_treasures(state.gameId, t1.x, t1.y, t2.x, t2.y, t3.x, t3.y)
        .send({ from: myAddress })
        .wait();

      setState((prev) => ({
        ...prev,
        myTreasurePositions: [...prev.selectedTreasures],
      }));

      addLog('Treasures placed!');
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to place treasures - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage || 'Failed to place treasures');
      setLoading(false);
    }
  }, [wallet, myAddress, contractAddress, state.gameId, state.selectedTreasures, setLoading, setError, addLog, refreshGameState]);

  const dig = useCallback(
    async (x: number, y: number) => {
      if (!wallet || !myAddress || !contractAddress || !state.gameId) return;

      setLoading(true, 'Digging...');

      try {
        const contract = TreasureHuntContract.at(contractAddress, wallet);
        await contract.methods.dig(state.gameId, x, y).send({ from: myAddress }).wait();

        addLog(`Dug at position (${x}, ${y})`);
        await refreshGameState();
      } catch (err: unknown) {
        console.error('Failed to dig - Full error:', err);
        const errorMessage = extractErrorMessage(err);
        setError(errorMessage || 'Failed to dig');
        setLoading(false);
      }
    },
    [wallet, myAddress, contractAddress, state.gameId, setLoading, setError, addLog, refreshGameState]
  );

  const respondDig = useCallback(async () => {
    if (!wallet || !myAddress || !contractAddress || !state.gameId) return;

    setLoading(true, 'Responding...');

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.respond_dig(state.gameId).send({ from: myAddress }).wait();

      addLog('Responded to dig action');
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to respond - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      setError(errorMessage || 'Failed to respond');
      setLoading(false);
    }
  }, [wallet, myAddress, contractAddress, state.gameId, setLoading, setError, addLog, refreshGameState]);

  const toggleTreasure = useCallback((x: number, y: number) => {
    setState((prev) => {
      const idx = prev.selectedTreasures.findIndex((t) => t.x === x && t.y === y);
      if (idx >= 0) {
        return {
          ...prev,
          selectedTreasures: prev.selectedTreasures.filter((_, i) => i !== idx),
        };
      } else if (prev.selectedTreasures.length < 3) {
        return {
          ...prev,
          selectedTreasures: [...prev.selectedTreasures, { x, y }],
        };
      }
      return prev;
    });
  }, []);

  const setSelectedAction = useCallback((action: PowerType) => {
    setState((prev) => ({ ...prev, selectedAction: action }));
  }, []);

  const resetGame = useCallback(() => {
    setState({
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
      powers: { ...initialPowers },
    });
  }, []);

  const setGameId = useCallback((gameId: Fr) => {
    setState((prev) => ({ ...prev, gameId }));
  }, []);

  return {
    ...state,
    createGame,
    joinGame,
    placeTreasures,
    dig,
    respondDig,
    toggleTreasure,
    setSelectedAction,
    refreshGameState,
    resetGame,
    setError,
    setGameId,
  };
}
