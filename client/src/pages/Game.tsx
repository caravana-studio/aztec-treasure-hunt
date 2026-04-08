import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Fr } from '@aztec/aztec.js/fields';
import { useWallet } from '../context/WalletContext';
import { useGame } from '../hooks/useGame';
import { useGameAudio } from '../hooks/useGameAudio';
import { PlayerCard, PowersPanel, GameGrid, GameLogs, TurnIndicator } from '../components/game';
import { AnimatedClouds } from '../components/ui/AnimatedClouds';

export function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { myAddress } = useWallet();

  const {
    gameId,
    gamePhase,
    isPlayer1,
    isMyTurn,
    myScore,
    opponentScore,
    winner,
    mySetupDone,
    selectedTreasures,
    myTreasurePositions,
    dugCells,
    diggingCell,
    activeAction,
    selectedAction,
    isLoading,
    statusMessage,
    error,
    logs,
    powers,
    scannedArea,
    compassResult,
    setGameId,
    refreshGameState,
    placeTreasures,
    dig,
    useDetector,
    useCompass,
    useShovel,
    setShovelSource,
    shovelSourcePosition,
    useTrap,
    myTrapPositions,
    hasExtraTurn,
    toggleTreasure,
    clearSelectedTreasures,
    setSelectedAction,
    resetGame,
    setError,
  } = useGame();
  const [showTreasureConfirmModal, setShowTreasureConfirmModal] = useState(false);
  const isActionLocked =
    isLoading ||
    gamePhase === 'awaiting' ||
    Boolean(activeAction);

  useGameAudio({
    enabled: Boolean(myAddress),
    resetKey: gameId?.toString() ?? id ?? '',
    gamePhase,
    selectedTreasureCount: selectedTreasures.length,
    activeAction,
    dugCells,
  });

  // Initialize game state from URL param
  useEffect(() => {
    if (id && !gameId) {
      const frId = new Fr(Number(id));
      setGameId(frId);
    }
  }, [id, gameId, setGameId]);

  // Refresh game state when gameId is set
  useEffect(() => {
    if (gameId && myAddress) {
      refreshGameState(gameId);
    }
  }, [gameId, myAddress]);

  // Auto-polling when waiting for opponent
  useEffect(() => {
    if (!gameId || !myAddress || isLoading) return;

    // Determine if we should poll
    const shouldPoll =
      gamePhase === 'lobby' || // Waiting for player2 to join
      (gamePhase === 'setup' && mySetupDone) || // Waiting for opponent to place treasures
      (gamePhase === 'playing' && !isMyTurn); // Waiting for opponent's turn

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      refreshGameState();
    }, 3000);

    return () => clearInterval(interval);
  }, [gameId, myAddress, gamePhase, mySetupDone, isMyTurn, isLoading, refreshGameState]);

  useEffect(() => {
    const shouldShow =
      gamePhase === 'setup' &&
      !mySetupDone &&
      selectedTreasures.length === 3;

    setShowTreasureConfirmModal(shouldShow);
  }, [gamePhase, mySetupDone, selectedTreasures.length]);

  // Handle grid click based on game phase
  const handleGridClick = (x: number, y: number) => {
    if (isActionLocked) {
      return;
    }

    if (gamePhase === 'setup') {
      toggleTreasure(x, y);
    } else if (gamePhase === 'playing' && isMyTurn) {
      if (selectedAction === 'dig') {
        dig(x, y);
      } else if (selectedAction === 'detector' && powers.detector > 0) {
        useDetector(x, y);
      } else if (selectedAction === 'compass' && powers.compass > 0) {
        useCompass(x, y);
      } else if (selectedAction === 'shovel' && powers.shovel > 0) {
        const isMyTreasure = myTreasurePositions.some((t) => t.x === x && t.y === y);
        const isDug = dugCells.some((d) => d.x === x && d.y === y);

        if (!shovelSourcePosition) {
          // First click: select a treasure to move
          if (isMyTreasure) {
            setShovelSource({ x, y });
          }
        } else {
          // Second click: select destination
          if (shovelSourcePosition.x === x && shovelSourcePosition.y === y) {
            // Clicked same cell, cancel selection
            setShovelSource(null);
          } else if (!isDug && !isMyTreasure) {
            // Valid destination: not dug, not another treasure
            useShovel(shovelSourcePosition.x, shovelSourcePosition.y, x, y);
          }
        }
      } else if (selectedAction === 'trap' && powers.trap > 0) {
        const isDug = dugCells.some((d) => d.x === x && d.y === y);
        // Can place trap on any cell that hasn't been dug
        if (!isDug) {
          useTrap(x, y);
        }
      }
    }
  };

  // Get avatars based on whether you're player 1 or 2
  const myAvatar = isPlayer1 ? '/images/player_1.png' : '/images/player_2.png';
  const isWaitingForOpponent = gamePhase === 'lobby';
  const opponentAvatar = isWaitingForOpponent
    ? '/images/void_player.png'
    : isPlayer1
      ? '/images/player_2.png'
      : '/images/player_1.png';

  const handleCancelTreasurePlacement = () => {
    clearSelectedTreasures();
    setShowTreasureConfirmModal(false);
  };

  const handleConfirmTreasurePlacement = async () => {
    setShowTreasureConfirmModal(false);
    await placeTreasures();
  };

  if (!myAddress) {
    return (
      <div className="game-container game-container--empty">
        <AnimatedClouds className="game-clouds" />
        <div className="game-shell game-shell--empty">
          <div className="game-empty-state">
            <img src="/menu/logo.png" alt="Treasure Hunt" className="game-empty-state__logo" />
            <div className="game-empty-card">
              <p className="game-empty-card__eyebrow">Wallet required</p>
              <p className="game-empty-card__copy">
                Connect a wallet in the lobby to enter a game.
              </p>
              <button className="game-action-btn" onClick={() => navigate('/lobby')}>
                Go to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <AnimatedClouds className="game-clouds" />

      {error && (
        <div className="error-toast game-error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="game-shell">
        <div className="game-topbar">
          <div className="game-topbar__slot game-topbar__slot--left">
          </div>
          <div className="game-topbar__slot game-topbar__slot--center">
            <TurnIndicator
              isMyTurn={isMyTurn}
              gamePhase={gamePhase}
              gameId={id}
              mySetupDone={mySetupDone}
              hasExtraTurn={hasExtraTurn}
            />
          </div>
          <div className="game-topbar__slot game-topbar__slot--right">
            {isLoading && (
              <div className="game-activity-indicator" role="status" aria-live="polite" aria-label={statusMessage || 'Syncing game state'}>
                <span className="game-activity-indicator__spinner" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        <div className="game-stage">
          <aside className="game-rail game-rail--left">
            <div className={`game-rail__stack ${isMyTurn ? 'game-rail__stack--active' : 'game-rail__stack--inactive'}`}>
              <PlayerCard
                avatarSrc={myAvatar}
                score={myScore}
                isActive={isMyTurn}
                side="left"
              />
              <PowersPanel
                powers={powers}
                selectedAction={selectedAction}
                onSelectAction={setSelectedAction}
                disabled={!isMyTurn || gamePhase !== 'playing' || isActionLocked}
              />
            </div>
          </aside>

          <main className="game-center">
            <div className="game-board-frame">
              {gamePhase === 'lobby' && (
                <GameGrid clickable={false} />
              )}

              {gamePhase === 'setup' && !mySetupDone && (
                <>
                  <GameGrid
                    selectedCells={selectedTreasures}
                    clickable={!isLoading}
                    onCellClick={handleGridClick}
                  />
                </>
              )}

              {gamePhase === 'setup' && mySetupDone && (
                <GameGrid
                  myTreasures={myTreasurePositions}
                  showTreasures={myTreasurePositions.length > 0}
                  clickable={false}
                />
              )}

              {(gamePhase === 'playing' || gamePhase === 'awaiting') && (
                <GameGrid
                  myTreasures={myTreasurePositions}
                  myTraps={myTrapPositions}
                  dugCells={dugCells}
                  clickable={isMyTurn && gamePhase === 'playing' && !isActionLocked}
                  onCellClick={handleGridClick}
                  showTreasures
                  diggingCell={diggingCell}
                  activeAction={activeAction}
                  scannedArea={scannedArea}
                  compassResult={compassResult}
                  selectedAction={selectedAction}
                  shovelSourcePosition={shovelSourcePosition}
                />
              )}

              {gamePhase === 'finished' && (
                <div className="game-finished-card">
                  <p className="game-finished-card__eyebrow">Game complete</p>
                  <h2
                    className={`game-finished-card__title ${winner === 'You Win!' ? 'is-win' : 'is-loss'}`}
                  >
                    {winner}
                  </h2>
                  <button
                    className="game-action-btn"
                    onClick={() => {
                      resetGame();
                      navigate('/lobby');
                    }}
                  >
                    Back to Lobby
                  </button>
                </div>
              )}
            </div>

          </main>

          <aside className="game-rail game-rail--right">
            <div
              className={`game-rail__stack ${
                isWaitingForOpponent
                  ? 'game-rail__stack--waiting'
                  : !isMyTurn
                    ? 'game-rail__stack--active'
                    : 'game-rail__stack--inactive'
              }`}
            >
              <PlayerCard
                avatarSrc={opponentAvatar}
                score={opponentScore}
                isActive={!isWaitingForOpponent && !isMyTurn}
                isOpponent
                side="right"
                isWaiting={isWaitingForOpponent}
              />
              {!isWaitingForOpponent && (
                <div className="game-rail__logs">
                  <GameLogs logs={logs} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showTreasureConfirmModal && (
        <div
          className="game-setup-modal"
          onClick={handleCancelTreasurePlacement}
        >
          <div
            className="game-setup-modal__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="game-setup-modal__hero">
              <img src="/menu/hide_treasure.png" alt="" className="game-setup-modal__hero-image" />
            </div>

            <div className="game-setup-modal__body">
              <p className="game-setup-modal__title">CONFIRM TREASURES</p>
              <p className="game-setup-modal__copy">
                Lock in your three treasure positions?
              </p>

              <div className="game-setup-modal__positions">
                {selectedTreasures.map((treasure, index) => (
                  <span key={`${treasure.x}-${treasure.y}`} className="game-setup-modal__position-pill">
                    Chest {index + 1}: ({treasure.x}, {treasure.y})
                  </span>
                ))}
              </div>

              <div className="game-setup-modal__actions">
                <button
                  type="button"
                  className="game-setup-modal__cancel"
                  onClick={handleCancelTreasurePlacement}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="game-setup-modal__confirm"
                  onClick={() => {
                    void handleConfirmTreasurePlacement();
                  }}
                  disabled={isLoading}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
