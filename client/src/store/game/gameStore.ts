import { create } from 'zustand';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { TreasureHuntContract } from '../../artifacts/TreasureHunt';
import { useMultiWalletStore } from '../../wallet/store';
import { getSponsoredFeePaymentMethod } from '../../wallet/connectors/EmbeddedConnector';
import {
  GameState,
  GamePhase,
  PowerType,
  DugCell,
  ScannedArea,
  CompassResult,
  Position,
  ActiveAction,
  INITIAL_POWERS,
  ACTION_NONE,
  ACTION_DIG,
  ACTION_DETECTOR,
  ACTION_COMPASS,
  STATUS_CREATED,
  STATUS_SETUP,
  STATUS_PLAYING,
  STATUS_AWAITING,
  STATUS_FINISHED,
} from '../../types/game';

// Helper to calculate 3x3 area cells around a center point
function getScannedCells(centerX: number, centerY: number): Position[] {
  const cells: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x >= 0 && x < 8 && y >= 0 && y < 8) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

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

type SimulatedValue<T> = T | { result: T };

function unwrapSimulationResult<T>(value: SimulatedValue<T>): T {
  if (value && typeof value === 'object' && 'result' in value) {
    return (value as { result: T }).result;
  }
  return value as T;
}

function toFr(value: bigint | number | string | Fr): Fr {
  if (value instanceof Fr) {
    return value;
  }
  if (typeof value === 'string') {
    return new Fr(BigInt(value));
  }
  return new Fr(value);
}

function toNumber(value: bigint | number | string | Fr): number {
  return value instanceof Fr ? Number(value.toBigInt()) : Number(value);
}

function getSendOptions(from: AztecAddress) {
  const paymentMethod = getSponsoredFeePaymentMethod();
  if (!paymentMethod) {
    return { from };
  }
  return {
    from,
    fee: {
      paymentMethod,
    },
  };
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
  useDetector: (x: number, y: number) => Promise<void>;
  respondDetector: () => Promise<void>;
  useCompass: (x: number, y: number) => Promise<void>;
  respondCompass: () => Promise<void>;
  useShovel: (oldX: number, oldY: number, newX: number, newY: number) => Promise<void>;
  setShovelSource: (position: Position | null) => void;
  useTrap: (x: number, y: number) => Promise<void>;

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
  activeAction: null,
  selectedAction: 'dig',
  isLoading: false,
  statusMessage: '',
  error: null,
  logs: [],
  powers: { ...INITIAL_POWERS },
  lastDetectorCount: 0,
  lastDetectorPosition: null,
  scannedArea: null,
  lastCompassDistance: null,
  lastCompassPosition: null,
  compassResult: null,
  shovelSourcePosition: null,
  myTrapPositions: [],
  hasExtraTurn: false,
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
    set({ selectedAction: action, shovelSourcePosition: null });
  },

  setShovelSource: (position: Position | null) => {
    set({ shovelSourcePosition: position });
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

    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameIdToUse) {
      return;
    }

    try {
      set({ isLoading: true, statusMessage: 'Refreshing...' });

      const contract = TreasureHuntContract.at(contractAddress, wallet);

      // Use get_game to fetch all public game state in a single call
      const game = unwrapSimulationResult(await contract.methods.get_game(gameIdToUse).simulate({ from: myAddress }));

      const status = BigInt(game.status);
      const isP1 = game.player1.toString() === myAddress.toString();
      const myTurn = game.current_turn.toString() === myAddress.toString();
      const pendingActionType = BigInt(game.pending_action);
      const pendingX = Number(game.pending_x);
      const pendingY = Number(game.pending_y);
      const p1Score = Number(game.player1_found);
      const p2Score = Number(game.player2_found);
      const mySetupDone = isP1 ? game.player1_setup_done : game.player2_setup_done;

      // Check extra_turn status (player who gets an extra turn due to opponent hitting their trap)
      const extraTurnAddress = game.extra_turn.toString();
      const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const hasExtraTurn = extraTurnAddress !== zeroAddress;
      const iHaveExtraTurn = hasExtraTurn && extraTurnAddress === myAddress.toString();

      const detectorCount = Number(game.last_detector_count);
      const compassDistance = Number(game.last_compass_distance);

      let gamePhase: GamePhase = 'lobby';
      let winner: string | null = null;

      const { gamePhase: previousPhase, addLog: logPhaseChange, lastDetectorPosition: prevDetectorPos, lastCompassPosition: prevCompassPos } = get();

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
          const myPowers = unwrapSimulationResult(
            await contract.methods.get_my_powers(gameIdToUse, myAddress).simulate({ from: myAddress })
          );
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
          const digResults = unwrapSimulationResult(
            await contract.methods.get_all_dig_results(gameIdToUse).simulate({ from: myAddress })
          );
          for (let i = 0; i < 64; i++) {
            const result = Number(digResults[i]);
            if (result > 0) {
              const x = i % 8;
              const y = Math.floor(i / 8);
              const digger = Math.floor(result / 4);
              const resultType = result % 4;
              const isMine = (isP1 && digger === 1) || (!isP1 && digger === 2);
              // resultType: 1=empty, 2=treasure, 3=trap
              dugCells.push({ x, y, found: resultType === 2, hitTrap: resultType === 3, isMine });
            }
          }
        } catch (err) {
          console.error('Failed to fetch dig results:', err);
        }
      }

      // Clear diggingCell and activeAction when the action is complete (no longer awaiting)
      const { diggingCell: currentDiggingCell, activeAction: currentActiveAction, dugCells: previousDugCells, addLog } = get();
      const shouldClearDiggingCell = currentDiggingCell && (
        gamePhase !== 'awaiting' || pendingActionType === ACTION_NONE
      );
      const shouldClearActiveAction = currentActiveAction && (
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
          } else if (cell.hitTrap) {
            if (cell.isMine) {
              addLog(`You hit a trap at (${cell.x}, ${cell.y})! You lose your next turn.`);
            } else {
              addLog(`Opponent hit your trap at (${cell.x}, ${cell.y})! They lose their next turn.`);
            }
          } else {
            addLog(`${who} found nothing at (${cell.x}, ${cell.y})`);
          }
        }
      }

      // Detect new detector results and log them
      // A new detector result is indicated when:
      // 1. We were previously in awaiting state with detector pending
      // 2. Now we're back to playing and the detector count might have changed
      let newDetectorPosition = prevDetectorPos;
      let newScannedArea: ScannedArea | null = get().scannedArea;

      if (prevDetectorPos && gamePhase === 'playing' && previousPhase === 'awaiting') {
        // Log the detector result for the player who used it
        const treasureWord = detectorCount === 1 ? 'treasure' : 'treasures';
        addLog(`Scan complete: ${detectorCount} ${treasureWord} found in 3x3 area around (${prevDetectorPos.x}, ${prevDetectorPos.y})`);

        // Create scanned area for visual feedback
        newScannedArea = {
          center: prevDetectorPos,
          cells: getScannedCells(prevDetectorPos.x, prevDetectorPos.y),
          result: detectorCount,
        };

        newDetectorPosition = null; // Clear after logging
      }

      // Detect new compass results and log them
      let newCompassPosition = prevCompassPos;
      let newCompassDistance: number | null = get().lastCompassDistance;
      let newCompassResult: CompassResult | null = get().compassResult;

      if (prevCompassPos && gamePhase === 'playing' && previousPhase === 'awaiting') {
        // Log the compass result for the player who used it
        const cellWord = compassDistance === 1 ? 'cell' : 'cells';
        addLog(`Compass result: Nearest treasure is ${compassDistance} ${cellWord} away from (${prevCompassPos.x}, ${prevCompassPos.y})`);

        newCompassDistance = compassDistance;
        newCompassPosition = null; // Clear after logging

        // Create compass result for visual feedback
        newCompassResult = {
          position: prevCompassPos,
          distance: compassDistance,
        };
      }

      // Track extra turn changes and log them
      const { hasExtraTurn: previousHasExtraTurn, logs: currentLogs } = get();

      // Detect when I just got an extra turn (opponent hit my trap)
      // Check if we already logged this to avoid duplicates from polling
      const alreadyLoggedExtraTurn = currentLogs.some(
        (log) => log.message === 'Opponent hit your trap! You get an extra turn!'
      );
      if (iHaveExtraTurn && !previousHasExtraTurn && !alreadyLoggedExtraTurn) {
        addLog('Opponent hit your trap! You get an extra turn!');
      } else if (!iHaveExtraTurn && previousHasExtraTurn && gamePhase === 'playing') {
        // Extra turn was just consumed
        addLog('Extra turn used.');
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
        lastDetectorCount: detectorCount,
        lastDetectorPosition: newDetectorPosition,
        scannedArea: newScannedArea,
        lastCompassDistance: newCompassDistance,
        lastCompassPosition: newCompassPosition,
        compassResult: newCompassResult,
        hasExtraTurn: iHaveExtraTurn,
        ...(shouldClearDiggingCell && { diggingCell: null }),
        ...(shouldClearActiveAction && { activeAction: null }),
      });

      // Auto-respond to pending actions if needed
      // When game is awaiting and it's NOT my turn, I need to respond
      if (gamePhase === 'awaiting' && !myTurn) {
        if (pendingActionType === ACTION_DIG) {
          console.log('Auto-responding to dig action...');
          setTimeout(() => {
            const { respondDig } = get();
            respondDig();
          }, 100);
        } else if (pendingActionType === ACTION_DETECTOR) {
          console.log('Auto-responding to detector action...');
          setTimeout(() => {
            const { respondDetector } = get();
            respondDetector();
          }, 100);
        } else if (pendingActionType === ACTION_COMPASS) {
          console.log('Auto-responding to compass action...');
          setTimeout(() => {
            const { respondCompass } = get();
            respondCompass();
          }, 100);
        }
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
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress) {
      return null;
    }

    set({ isLoading: true, statusMessage: 'Creating game...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const nextGameId = unwrapSimulationResult(await contract.methods.get_next_game_id().simulate({ from: myAddress }));
      const id = toFr(nextGameId);

      await contract.methods.create_game().send(getSendOptions(myAddress));

      set({ gameId: id, isPlayer1: true });

      addLog(`Game #${toNumber(nextGameId)} created! Share this ID with your opponent`);
      await refreshGameState(id);

      return toNumber(nextGameId);
    } catch (err: unknown) {
      console.error('Failed to create game - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to create game', isLoading: false });
      return null;
    }
  },

  joinGame: async (gameIdStr: string) => {
    const { addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameIdStr) {
      return null;
    }

    set({ isLoading: true, statusMessage: 'Joining game...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const id = new Fr(Number(gameIdStr));
      await contract.methods.join_game(id).send(getSendOptions(myAddress));

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
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId || selectedTreasures.length !== 3) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Placing treasures...', error: null });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      const [t1, t2, t3] = selectedTreasures;
      await contract.methods
        .place_treasures(gameId, t1.x, t1.y, t2.x, t2.y, t3.x, t3.y)
        .send(getSendOptions(myAddress));

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
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({
      isLoading: true,
      statusMessage: 'Digging...',
      diggingCell: { x, y },
      activeAction: { type: 'dig', position: { x, y } },
    });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.dig(gameId, x, y).send(getSendOptions(myAddress));

      addLog(`You dig at (${x}, ${y})...`);
      // Don't clear activeAction here - keep animation until opponent responds
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to dig - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to dig', isLoading: false, diggingCell: null, activeAction: null });
    }
  },

  respondDig: async () => {
    const { gameId, pendingX, pendingY, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Checking dig result...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);

      console.log('Responding to dig at:', pendingX, pendingY);

      await contract.methods.check_dig_result(gameId, pendingX, pendingY).send(getSendOptions(myAddress));

      addLog(`Opponent digs at (${pendingX}, ${pendingY})...`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to respond - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to respond', isLoading: false });
    }
  },

  useDetector: async (x: number, y: number) => {
    const { gameId, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({
      isLoading: true,
      statusMessage: 'Scanning area...',
      lastDetectorPosition: { x, y },
      activeAction: { type: 'detector', position: { x, y } },
    });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.use_detector(gameId, x, y).send(getSendOptions(myAddress));

      addLog(`You scan area around (${x}, ${y})...`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to use detector - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to use detector', isLoading: false, lastDetectorPosition: null, activeAction: null });
    }
  },

  respondDetector: async () => {
    const { gameId, pendingX, pendingY, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Processing scan...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);

      console.log('Responding to detector at:', pendingX, pendingY);

      await contract.methods.respond_detector(gameId, pendingX, pendingY).send(getSendOptions(myAddress));

      addLog(`Opponent scans area around (${pendingX}, ${pendingY})`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to respond to detector - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to respond', isLoading: false });
    }
  },

  useCompass: async (x: number, y: number) => {
    const { gameId, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({
      isLoading: true,
      statusMessage: 'Using compass...',
      lastCompassPosition: { x, y },
      activeAction: { type: 'compass', position: { x, y } },
    });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.use_compass(gameId, x, y).send(getSendOptions(myAddress));

      addLog(`You use compass from (${x}, ${y})...`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to use compass - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to use compass', isLoading: false, lastCompassPosition: null, activeAction: null });
    }
  },

  respondCompass: async () => {
    const { gameId, pendingX, pendingY, addLog, refreshGameState } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({ isLoading: true, statusMessage: 'Processing compass...' });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);

      console.log('Responding to compass at:', pendingX, pendingY);

      await contract.methods.respond_compass(gameId, pendingX, pendingY).send(getSendOptions(myAddress));

      addLog(`Opponent uses compass from (${pendingX}, ${pendingY})`);
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to respond to compass - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to respond', isLoading: false });
    }
  },

  useShovel: async (oldX: number, oldY: number, newX: number, newY: number) => {
    const { gameId, addLog, refreshGameState, myTreasurePositions } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({
      isLoading: true,
      statusMessage: 'Moving treasure...',
      activeAction: { type: 'shovel', position: { x: newX, y: newY } },
      shovelSourcePosition: null,
    });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.use_shovel(gameId, oldX, oldY, newX, newY).send(getSendOptions(myAddress));

      // Update local treasure positions
      const newTreasurePositions = myTreasurePositions.map((pos) =>
        pos.x === oldX && pos.y === oldY ? { x: newX, y: newY } : pos
      );

      addLog(`You moved treasure from (${oldX}, ${oldY}) to (${newX}, ${newY})`);
      set({ myTreasurePositions: newTreasurePositions, activeAction: null });
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to use shovel - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to use shovel', isLoading: false, activeAction: null });
    }
  },

  useTrap: async (x: number, y: number) => {
    const { gameId, addLog, refreshGameState, myTrapPositions } = get();
    const { wallet, address: myAddress, contractAddress } = useMultiWalletStore.getState();

    if (!wallet || !myAddress || !contractAddress || !gameId) {
      return;
    }

    set({
      isLoading: true,
      statusMessage: 'Placing trap...',
      activeAction: { type: 'trap', position: { x, y } },
    });

    try {
      const contract = TreasureHuntContract.at(contractAddress, wallet);
      await contract.methods.use_trap(gameId, x, y).send(getSendOptions(myAddress));

      // Add trap position to local state for visual feedback
      const newTrapPositions = [...myTrapPositions, { x, y }];

      addLog(`You placed a trap at (${x}, ${y})`);
      set({ activeAction: null, selectedAction: 'dig', myTrapPositions: newTrapPositions });
      await refreshGameState();
    } catch (err: unknown) {
      console.error('Failed to use trap - Full error:', err);
      const errorMessage = extractErrorMessage(err);
      set({ error: errorMessage || 'Failed to place trap', isLoading: false, activeAction: null });
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
