interface TurnIndicatorProps {
  isMyTurn: boolean;
  gamePhase: string;
  gameId?: string;
}

export function TurnIndicator({ isMyTurn, gamePhase, gameId }: TurnIndicatorProps) {
  let text = '';

  switch (gamePhase) {
    case 'lobby':
      text = `Game ID: ${gameId} · Waiting for opponent...`;
      break;
    case 'setup':
      text = 'Place Your Treasures';
      break;
    case 'playing':
      text = isMyTurn ? 'Your Turn' : "Opponent's Turn";
      break;
    case 'awaiting':
      text = isMyTurn ? 'Waiting...' : 'Action Required';
      break;
    case 'finished':
      text = 'Game Over';
      break;
    default:
      text = '';
  }

  if (!text) return null;

  return (
    <div className="turn-indicator">
      <div className="turn-indicator-box">
        <span className="turn-text">{text}</span>
      </div>
    </div>
  );
}
