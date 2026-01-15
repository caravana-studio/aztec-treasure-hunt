import { useState, useEffect, useCallback } from 'react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { EmbeddedWallet } from './embedded-wallet';
import { TreasureHuntContract } from './artifacts/TreasureHunt';

// Game status constants
const STATUS_CREATED = 0n;
const STATUS_SETUP = 1n;
const STATUS_PLAYING = 2n;
const STATUS_AWAITING = 3n;
const STATUS_FINISHED = 4n;

// Pending action types
const ACTION_NONE = 0n;
const ACTION_DIG = 1n;
const ACTION_DETECTOR = 2n;
const ACTION_COMPASS = 3n;

const GRID_SIZE = 8;

type Position = { x: number; y: number };
type GamePhase = 'loading' | 'lobby' | 'setup' | 'playing' | 'awaiting' | 'finished';

function App() {
  // Wallet state
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [myAddress, setMyAddress] = useState<AztecAddress | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('loading');
  const [gameId, setGameId] = useState<string>('');
  const [currentGameId, setCurrentGameId] = useState<Fr | null>(null);
  const [isPlayer1, setIsPlayer1] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<bigint>(ACTION_NONE);

  // Setup state
  const [selectedTreasures, setSelectedTreasures] = useState<Position[]>([]);
  const [myTreasurePositions, setMyTreasurePositions] = useState<Position[]>([]);

  // Action state
  const [selectedAction, setSelectedAction] = useState<string>('dig');
  const [dugCells, setDugCells] = useState<(Position & { found: boolean })[]>([]);

  // UI state
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet
  useEffect(() => {
    async function init() {
      try {
        const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
        const deployerAddress = import.meta.env.VITE_DEPLOYER_ADDRESS;
        const deploymentSalt = import.meta.env.VITE_DEPLOYMENT_SALT;
        const nodeUrl = import.meta.env.VITE_AZTEC_NODE_URL;

        if (!contractAddress) {
          throw new Error('Missing environment variables. Run yarn deploy-contracts first.');
        }

        setStatusMessage('Connecting to Aztec node...');
        const w = await EmbeddedWallet.initialize(nodeUrl);

        setStatusMessage('Registering contract...');
        const instance = await getContractInstanceFromInstantiationParams(
          TreasureHuntContract.artifact,
          {
            deployer: AztecAddress.fromString(deployerAddress),
            salt: Fr.fromString(deploymentSalt),
            constructorArgs: [AztecAddress.fromString(deployerAddress)],
          }
        );
        await w.registerContract(instance, TreasureHuntContract.artifact);

        setWallet(w);

        // Try to connect existing account
        const existingAccount = await w.connectExistingAccount();
        if (existingAccount) {
          setMyAddress(existingAccount);
        }

        setGamePhase('lobby');
        setStatusMessage('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    }
    init();
  }, []);

  // Create account
  const handleCreateAccount = async () => {
    if (!wallet) return;
    setIsConnecting(true);
    setError(null);
    try {
      setStatusMessage('Creating account...');
      const account = await wallet.createAccountAndConnect();
      setMyAddress(account);
      setStatusMessage('Account created!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect test account
  const handleConnectTestAccount = async (index: number) => {
    if (!wallet) return;
    setIsConnecting(true);
    setError(null);
    try {
      setStatusMessage('Connecting test account...');
      const account = await wallet.connectTestAccount(index);
      setMyAddress(account);
      setStatusMessage('Connected!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect test account');
    } finally {
      setIsConnecting(false);
    }
  };

  // Create game
  const handleCreateGame = async () => {
    if (!wallet || !myAddress || !gameId) return;
    setIsLoading(true);
    setError(null);
    try {
      setStatusMessage('Creating game...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );
      const id = new Fr(Number(gameId));
      await contract.methods.create_game(id).send({ from: myAddress }).wait();
      setCurrentGameId(id);
      setIsPlayer1(true);
      setStatusMessage('Game created! Waiting for player 2...');
      await refreshGameState(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  // Join game
  const handleJoinGame = async () => {
    if (!wallet || !myAddress || !gameId) return;
    setIsLoading(true);
    setError(null);
    try {
      setStatusMessage('Joining game...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );
      const id = new Fr(Number(gameId));
      await contract.methods.join_game(id).send({ from: myAddress }).wait();
      setCurrentGameId(id);
      setIsPlayer1(false);
      setStatusMessage('Joined! Place your treasures.');
      await refreshGameState(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  // Place treasures
  const handlePlaceTreasures = async () => {
    if (!wallet || !myAddress || !currentGameId || selectedTreasures.length !== 3) return;
    setIsLoading(true);
    setError(null);
    try {
      setStatusMessage('Placing treasures...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );
      const [t1, t2, t3] = selectedTreasures;
      await contract.methods
        .place_treasures(currentGameId, t1.x, t1.y, t2.x, t2.y, t3.x, t3.y)
        .send({ from: myAddress })
        .wait();
      setMyTreasurePositions([...selectedTreasures]);
      setStatusMessage('Treasures placed!');
      await refreshGameState(currentGameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place treasures');
    } finally {
      setIsLoading(false);
    }
  };

  // Dig action
  const handleDig = async (x: number, y: number) => {
    if (!wallet || !myAddress || !currentGameId) return;
    setIsLoading(true);
    try {
      setStatusMessage('Digging...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );
      await contract.methods.dig(currentGameId, x, y).send({ from: myAddress }).wait();
      setStatusMessage('Waiting for opponent to respond...');
      await refreshGameState(currentGameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dig');
    } finally {
      setIsLoading(false);
    }
  };

  // Respond to action
  const handleRespond = async () => {
    if (!wallet || !myAddress || !currentGameId) return;
    setIsLoading(true);
    try {
      setStatusMessage('Responding...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );

      if (pendingAction === ACTION_DIG) {
        await contract.methods.respond_dig(currentGameId).send({ from: myAddress }).wait();
      }
      // Add other response types as needed

      setStatusMessage('Response sent!');
      await refreshGameState(currentGameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh game state
  const refreshGameState = useCallback(async (id?: Fr) => {
    const gameIdToUse = id || currentGameId;
    if (!wallet || !myAddress || !gameIdToUse) return;

    try {
      setStatusMessage('Refreshing...');
      const contract = TreasureHuntContract.at(
        AztecAddress.fromString(import.meta.env.VITE_CONTRACT_ADDRESS),
        wallet
      );

      const status = await contract.methods.get_game_status(gameIdToUse).simulate({ from: myAddress });
      const player1 = await contract.methods.get_player1(gameIdToUse).simulate({ from: myAddress });
      const p1Score = await contract.methods.get_player1_treasures_found(gameIdToUse).simulate({ from: myAddress });
      const p2Score = await contract.methods.get_player2_treasures_found(gameIdToUse).simulate({ from: myAddress });
      const currentTurn = await contract.methods.get_current_turn(gameIdToUse).simulate({ from: myAddress });
      const pending = await contract.methods.get_pending_action(gameIdToUse).simulate({ from: myAddress });

      const isP1 = player1.toString() === myAddress.toString();
      setIsPlayer1(isP1);
      setMyScore(Number(isP1 ? p1Score : p2Score));
      setOpponentScore(Number(isP1 ? p2Score : p1Score));
      setPendingAction(pending);

      const myTurn = (currentTurn === 1n && isP1) || (currentTurn === 2n && !isP1);
      setIsMyTurn(myTurn);

      // Determine phase
      if (status === STATUS_CREATED) {
        setGamePhase('lobby');
      } else if (status === STATUS_SETUP) {
        setGamePhase('setup');
      } else if (status === STATUS_PLAYING) {
        setGamePhase('playing');
      } else if (status === STATUS_AWAITING) {
        setGamePhase('awaiting');
      } else if (status === STATUS_FINISHED) {
        setGamePhase('finished');
        const w = await contract.methods.get_winner(gameIdToUse).simulate({ from: myAddress });
        setWinner(w.toString() === myAddress.toString() ? 'You Win!' : 'You Lose!');
      }

      setStatusMessage('');
    } catch (err) {
      console.error(err);
    }
  }, [wallet, myAddress, currentGameId]);

  // Toggle treasure selection in setup
  const toggleTreasure = (x: number, y: number) => {
    const idx = selectedTreasures.findIndex((t) => t.x === x && t.y === y);
    if (idx >= 0) {
      setSelectedTreasures(selectedTreasures.filter((_, i) => i !== idx));
    } else if (selectedTreasures.length < 3) {
      setSelectedTreasures([...selectedTreasures, { x, y }]);
    }
  };

  // Handle grid click during gameplay
  const handleGridClick = (x: number, y: number) => {
    if (selectedAction === 'dig' && isMyTurn) {
      handleDig(x, y);
    }
  };

  // Render grid
  const renderGrid = (
    onClick?: (x: number, y: number) => void,
    highlights?: Position[],
    showTreasures?: boolean
  ) => (
    <div className="grid">
      {Array.from({ length: GRID_SIZE }, (_, y) =>
        Array.from({ length: GRID_SIZE }, (_, x) => {
          const isSelected = highlights?.some((p) => p.x === x && p.y === y);
          const isTreasure = showTreasures && myTreasurePositions.some((p) => p.x === x && p.y === y);
          const dugCell = dugCells.find((p) => p.x === x && p.y === y);

          let className = 'grid-cell';
          if (isSelected) className += ' selected';
          if (isTreasure) className += ' treasure';
          if (dugCell) className += dugCell.found ? ' dug-found' : ' dug-empty';

          return (
            <div
              key={`${x}-${y}`}
              className={className}
              onClick={() => onClick?.(x, y)}
            />
          );
        })
      )}
    </div>
  );

  return (
    <div className="app">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-title">Treasure Hunt</div>
        <div className="nav-right">
          {myAddress ? (
            <span className="account-display">
              {myAddress.toString().slice(0, 6)}...{myAddress.toString().slice(-4)}
            </span>
          ) : (
            <>
              <select id="test-account">
                <option value="0">Account 1</option>
                <option value="1">Account 2</option>
                <option value="2">Account 3</option>
              </select>
              <button onClick={() => handleConnectTestAccount(Number((document.getElementById('test-account') as HTMLSelectElement).value))} disabled={isConnecting}>
                Connect Test
              </button>
              <button onClick={handleCreateAccount} disabled={isConnecting}>
                Create Account
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        {/* Error display */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading state */}
        {gamePhase === 'loading' && (
          <div className="card">
            <h2>Initializing...</h2>
            <p>{statusMessage}</p>
          </div>
        )}

        {/* Lobby */}
        {gamePhase === 'lobby' && myAddress && (
          <div className="card">
            <h2>Game Lobby</h2>
            <div className="lobby-form">
              <input
                type="number"
                placeholder="Game ID"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
              />
              <div className="lobby-buttons">
                <button onClick={handleCreateGame} disabled={isLoading || !gameId}>
                  Create Game
                </button>
                <button onClick={handleJoinGame} disabled={isLoading || !gameId}>
                  Join Game
                </button>
              </div>
            </div>
            {currentGameId && (
              <div className="game-info">
                <p>Game ID: {currentGameId.toString()}</p>
                <p>Waiting for opponent...</p>
              </div>
            )}
          </div>
        )}

        {/* Setup Phase */}
        {gamePhase === 'setup' && (
          <div className="card">
            <h2>Place Your Treasures ({selectedTreasures.length}/3)</h2>
            <p>Click on 3 cells to place your treasures</p>
            {renderGrid(toggleTreasure, selectedTreasures)}
            <button
              onClick={handlePlaceTreasures}
              disabled={selectedTreasures.length !== 3 || isLoading}
            >
              Confirm Treasures
            </button>
          </div>
        )}

        {/* Playing Phase */}
        {gamePhase === 'playing' && (
          <>
            <div className="grids-container">
              <div className="grid-panel">
                <h3>Your Treasures</h3>
                {renderGrid(undefined, undefined, true)}
              </div>
              <div className="grid-panel">
                <h3>Opponent's Grid</h3>
                <div className={isMyTurn ? 'clickable' : ''}>
                  {renderGrid(isMyTurn ? handleGridClick : undefined)}
                </div>
              </div>
            </div>

            <div className="card powers-card">
              <h3>Actions</h3>
              <div className="powers-buttons">
                {['dig', 'detector', 'compass', 'shovel', 'trap'].map((action) => (
                  <button
                    key={action}
                    className={`power-btn ${selectedAction === action ? 'active' : ''}`}
                    onClick={() => setSelectedAction(action)}
                    disabled={!isMyTurn}
                  >
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </button>
                ))}
              </div>
              <p className="action-hint">
                {isMyTurn ? `Click on opponent's grid to ${selectedAction}` : "Opponent's turn"}
              </p>
            </div>

            <div className="card score-card">
              <div className="score-display">
                <span>You: {myScore}/2</span>
                <span>Opponent: {opponentScore}/2</span>
              </div>
            </div>
          </>
        )}

        {/* Awaiting Response */}
        {gamePhase === 'awaiting' && (
          <div className="card">
            <h3>Action Required</h3>
            {!isMyTurn ? (
              <>
                <p>Your opponent performed an action. Click to respond.</p>
                <button onClick={handleRespond} disabled={isLoading}>
                  Respond
                </button>
              </>
            ) : (
              <p>Waiting for opponent to respond...</p>
            )}
          </div>
        )}

        {/* Finished */}
        {gamePhase === 'finished' && (
          <div className="card">
            <h2 className={winner === 'You Win!' ? 'winner' : 'loser'}>{winner}</h2>
            <button onClick={() => {
              setCurrentGameId(null);
              setGamePhase('lobby');
              setSelectedTreasures([]);
              setMyTreasurePositions([]);
              setDugCells([]);
            }}>
              New Game
            </button>
          </div>
        )}

        {/* Status message */}
        {statusMessage && <div className="status-message">{statusMessage}</div>}

        {/* Refresh button */}
        {currentGameId && gamePhase !== 'loading' && (
          <button className="refresh-btn" onClick={() => refreshGameState()} disabled={isLoading}>
            Refresh Game State
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
