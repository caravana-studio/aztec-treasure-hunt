interface PlayerCardProps {
  avatarSrc: string;
  score: number;
  isActive: boolean;
  isOpponent?: boolean;
  side: 'left' | 'right';
  isWaiting?: boolean;
}

const MAX_TREASURES = 2;

export function PlayerCard({
  avatarSrc,
  score,
  isActive,
  isOpponent = false,
  side,
  isWaiting = false,
}: PlayerCardProps) {
  const avatarVariant = isWaiting
    ? 'void'
    : avatarSrc.includes('player_1')
      ? 'player-1'
      : 'player-2';
  const shouldMirror =
    !isWaiting &&
    (avatarVariant === 'player-2' && side === 'left') ||
    (avatarVariant === 'player-1' && side === 'right');

  return (
    <div
      className={`player-card ${isActive ? 'active-turn' : ''} ${!isActive && isOpponent && !isWaiting ? 'grayed-out' : ''} ${
        isWaiting ? 'player-card--waiting' : ''
      }`}
    >
      <div
        className={`player-avatar-frame player-avatar-frame--${avatarVariant}${shouldMirror ? ' player-avatar-frame--mirrored' : ''}`}
      >
        <img
          src={avatarSrc}
          alt={isWaiting ? 'Waiting for player' : 'Player avatar'}
          className="player-avatar"
        />
      </div>

      {/* Treasure progress bar */}
      <div className="treasure-progress">
        <div className="treasure-progress-header">
          <img src="/images/treasure.png" alt="Treasures" className="treasure-icon" />
          <span className="treasure-count">{score} / {MAX_TREASURES}</span>
        </div>
        <div className="treasure-progress-bar">
          {Array.from({ length: MAX_TREASURES }, (_, i) => (
            <div
              key={i}
              className={`treasure-progress-step ${i < score ? 'filled' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
