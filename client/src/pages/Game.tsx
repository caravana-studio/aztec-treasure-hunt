import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Fr } from '@aztec/aztec.js/fields';
import { useWallet } from '../context/WalletContext';
import { useGame } from '../hooks/useGame';
import { PlayerCard } from '../components/PlayerCard';
import { PowersPanel } from '../components/PowersPanel';
import { GameGrid } from '../components/GameGrid';
import { GameLogs } from '../components/GameLogs';
import { TurnIndicator } from '../components/TurnIndicator';

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
    selectedTreasures,
    myTreasurePositions,
    dugCells,
    selectedAction,
    isLoading,
    statusMessage,
    error,
    logs,
    powers,
    setGameId,
    refreshGameState,
    placeTreasures,
    dig,
    respondDig,
    toggleTreasure,
    setSelectedAction,
    resetGame,
    setError,
    pendingAction,
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

  // Handle grid click based on game phase
  const handleGridClick = (x: number, y: number) => {
    if (gamePhase === 'setup') {
      toggleTreasure(x, y);
    } else if (gamePhase === 'playing' && isMyTurn && selectedAction === 'dig') {
      dig(x, y);
    }
  };

  // Handle action response
  const handleRespond = () => {
    if (pendingAction === 1n) {
      respondDig();
    }
  };

  // Get avatars based on whether you're player 1 or 2
  const myAvatar = isPlayer1 ? '/images/player_1.png' : '/images/player_2.png';
  const opponentAvatar = isPlayer1 ? '/images/player_2.png' : '/images/player_1.png';

  if (!myAddress) {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <p>Please connect your wallet first.</p>
          <button className="glass-btn" onClick={() => navigate('/lobby')}>
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <p>{statusMessage || 'Processing...'}</p>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Status toast */}
      {statusMessage && !isLoading && (
        <div className="status-toast">{statusMessage}</div>
      )}

      <div className="game-layout">
        {/* Turn indicator */}
        <TurnIndicator isMyTurn={isMyTurn} gamePhase={gamePhase} />

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
          {gamePhase === 'setup' && (
            <>
              <GameGrid
                selectedCells={selectedTreasures}
                clickable
                onCellClick={handleGridClick}
              />
              <div className="grid-actions">
                <button
                  className="glass-btn"
                  onClick={placeTreasures}
                  disabled={selectedTreasures.length !== 3 || isLoading}
                >
                  Confirm Treasures Position
                </button>
              </div>
            </>
          )}

          {(gamePhase === 'playing' || gamePhase === 'awaiting') && (
            <GameGrid
              myTreasures={myTreasurePositions}
              dugCells={dugCells}
              clickable={isMyTurn && gamePhase === 'playing'}
              onCellClick={handleGridClick}
              showTreasures
            />
          )}

          {gamePhase === 'awaiting' && !isMyTurn && (
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
              <button className="glass-btn" onClick={handleRespond} disabled={isLoading}>
                Respond to Action
              </button>
            </div>
          )}

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

      {/* Refresh button */}
      <button
        onClick={() => refreshGameState()}
        disabled={isLoading}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.9)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Refresh
      </button>
    </div>
  );
}
