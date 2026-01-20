interface TurnIndicatorProps {
  isMyTurn: boolean;
  gamePhase: string;
  gameId?: string;
  isLoading?: boolean;
  statusMessage?: string;
  mySetupDone?: boolean;
}

export function TurnIndicator({
  isMyTurn,
  gamePhase,
  gameId,
  isLoading,
  statusMessage,
  mySetupDone
}: TurnIndicatorProps) {
  let text = '';

  // If loading, show the status message
  if (isLoading && statusMessage) {
    text = statusMessage;
  } else {
    switch (gamePhase) {
      case 'lobby':
        text = `Game ID: ${gameId} · Waiting for opponent...`;
        break;
      case 'setup':
        if (mySetupDone) {
          text = '✓ Treasures placed! Waiting for opponent...';
        } else {
          text = 'Place Your Treasures (select 3 cells)';
        }
        break;
      case 'playing':
        text = isMyTurn ? 'Your Turn - Click a cell to dig' : "Opponent's Turn";
        break;
      case 'awaiting':
        text = isMyTurn ? 'Waiting for opponent response...' : 'Processing action...';
        break;
      case 'finished':
        text = 'Game Over';
        break;
      default:
        text = '';
    }
  }

  if (!text) return null;

  return (
    <div className="turn-indicator">
      <div className={`turn-indicator-box ${isLoading ? 'loading' : ''}`}>
        {isLoading && <span className="loading-dot">●</span>}
        <span className="turn-text">{text}</span>
      </div>
    </div>
  );
}
