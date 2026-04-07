interface TurnIndicatorProps {
  isMyTurn: boolean;
  gamePhase: string;
  gameId?: string;
  mySetupDone?: boolean;
  hasExtraTurn?: boolean;
}

export function TurnIndicator({
  isMyTurn,
  gamePhase,
  gameId,
  mySetupDone,
  hasExtraTurn
}: TurnIndicatorProps) {
  let text = '';

  if (hasExtraTurn && isMyTurn && gamePhase === 'playing') {
    text = 'Extra turn';
  } else {
    switch (gamePhase) {
      case 'lobby':
        text = `Game ${gameId} - Waiting for opponent`;
        break;
      case 'setup':
        if (mySetupDone) {
          text = 'Treasures placed. Waiting for opponent';
        } else {
          text = 'Place 3 treasures';
        }
        break;
      case 'playing':
        text = isMyTurn ? 'Your turn' : "Opponent's turn";
        break;
      case 'awaiting':
        text = isMyTurn ? 'Waiting for response' : 'Resolving action';
        break;
      case 'finished':
        text = 'Game over';
        break;
      default:
        text = '';
    }
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
