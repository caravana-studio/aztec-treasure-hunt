interface PlayerCardProps {
  avatarSrc: string;
  score: number;
  isActive: boolean;
  isOpponent?: boolean;
  side: 'left' | 'right';
}

const MAX_TREASURES = 2;

export function PlayerCard({ avatarSrc, score, isActive, isOpponent = false, side }: PlayerCardProps) {
  const avatarVariant = avatarSrc.includes('player_1') ? 'player-1' : 'player-2';
  const shouldMirror =
    (avatarVariant === 'player-2' && side === 'left') ||
    (avatarVariant === 'player-1' && side === 'right');

  return (
    <div className={`player-card ${isActive ? 'active-turn' : ''} ${!isActive && isOpponent ? 'grayed-out' : ''}`}>
      <div
        className={`player-avatar-frame player-avatar-frame--${avatarVariant}${shouldMirror ? ' player-avatar-frame--mirrored' : ''}`}
      >
        <img
          src={avatarSrc}
          alt="Player avatar"
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
