interface TurnIndicatorProps {
  isMyTurn: boolean;
  gamePhase: string;
}

export function TurnIndicator({ isMyTurn, gamePhase }: TurnIndicatorProps) {
  let text = '';

  switch (gamePhase) {
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
      <span className="turn-text">{text}</span>
    </div>
  );
}
