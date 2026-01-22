import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Fr } from '@aztec/aztec.js/fields';
import { useWallet } from '../context/WalletContext';
import { useGame } from '../hooks/useGame';
import { PlayerCard, PowersPanel, GameGrid, GameLogs, TurnIndicator } from '../components/game';

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
    toggleTreasure,
    setSelectedAction,
    resetGame,
    setError,
  } = useGame();

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

  // Handle grid click based on game phase
  const handleGridClick = (x: number, y: number) => {
    if (gamePhase === 'setup') {
      toggleTreasure(x, y);
    } else if (gamePhase === 'playing' && isMyTurn) {
      if (selectedAction === 'dig') {
        dig(x, y);
      } else if (selectedAction === 'detector' && powers.detector > 0) {
        useDetector(x, y);
      } else if (selectedAction === 'compass' && powers.compass > 0) {
        useCompass(x, y);
      }
    }
  };

  // Get avatars based on whether you're player 1 or 2
  const myAvatar = isPlayer1 ? '/images/player_1.png' : '/images/player_2.png';
  const opponentAvatar = isPlayer1 ? '/images/player_2.png' : '/images/player_1.png';

  if (!myAddress) {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
            <p style={{ margin: 0, color: 'white', textAlign: 'center' }}>Please connect your wallet first.</p>
            <button className="glass-btn" onClick={() => navigate('/lobby')}>
              Go to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    
    <div className="game-container">
       {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="game-layout">
        {/* Turn indicator */}
        <TurnIndicator
          isMyTurn={isMyTurn}
          gamePhase={gamePhase}
          gameId={id}
          isLoading={isLoading}
          statusMessage={statusMessage}
          mySetupDone={mySetupDone}
        />

        {/* Left panel - YOUR info */}
        <div className="player-panel left">
          <PlayerCard
            avatarSrc={myAvatar}
            score={myScore}
            isActive={isMyTurn}
          />
          <PowersPanel
            powers={powers}
            selectedAction={selectedAction}
            onSelectAction={setSelectedAction}
            disabled={!isMyTurn || gamePhase !== 'playing'}
          />
        </div>

        {/* Center - Grid */}
        <div className="grid-container">
          {gamePhase === 'lobby' && (
            <GameGrid clickable={false} />
          )}

          {gamePhase === 'setup' && !mySetupDone && (
            <>
              <GameGrid
                selectedCells={selectedTreasures}
                clickable
                onCellClick={handleGridClick}
              />
              {!isLoading && (
                <div className="grid-actions">
                  <button
                    className="glass-btn"
                    onClick={placeTreasures}
                    disabled={selectedTreasures.length !== 3}
                  >
                    Confirm Treasures Position
                  </button>
                </div>
              )}
            </>
          )}

          {gamePhase === 'setup' && mySetupDone && (
            <>
              <GameGrid
                myTreasures={myTreasurePositions}
                showTreasures={myTreasurePositions.length > 0}
                clickable={false}
              />
              {/* <div className="grid-actions">
                <p style={{ color: 'white', textAlign: 'center', margin: 0 }}>
                  ✓ Treasures placed! Waiting for opponent...
                </p>
              </div> */}
            </>
          )}

          {(gamePhase === 'playing' || gamePhase === 'awaiting') && (
            <GameGrid
              myTreasures={myTreasurePositions}
              dugCells={dugCells}
              clickable={isMyTurn && gamePhase === 'playing'}
              onCellClick={handleGridClick}
              showTreasures
              diggingCell={diggingCell}
              activeAction={activeAction}
              scannedArea={scannedArea}
              compassResult={compassResult}
              selectedAction={selectedAction}
            />
          )}

          {/* {gamePhase === 'awaiting' && !isMyTurn && (
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
              <button className="glass-btn" onClick={handleRespond} disabled={isLoading}>
                Respond to Action
              </button>
            </div>
          )} */}

          {gamePhase === 'finished' && (
            <div style={{ textAlign: 'center' }}>
              <h2
                style={{
                  color: winner === 'You Win!' ? '#27ae60' : '#e74c3c',
                  fontSize: '48px',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  marginBottom: '24px',
                }}
              >
                {winner}
              </h2>
              <button
                className="glass-btn"
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

        {/* Right panel - OPPONENT info */}
        <div className="player-panel right">
          <PlayerCard
            avatarSrc={opponentAvatar}
            score={opponentScore}
            isActive={!isMyTurn}
            isOpponent
          />
          <PowersPanel
            powers={powers}
            selectedAction={selectedAction}
            onSelectAction={() => {}}
            disabled
            isOpponent
          />
        </div>

        {/* Logs panel - only show when both players have joined (setup phase or later) */}
        {gamePhase !== 'lobby' && (
          <GameLogs logs={logs} />
        )}
      </div>

    </div>
  );
}
