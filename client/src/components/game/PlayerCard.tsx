interface PlayerCardProps {
  avatarSrc: string;
  score: number;
  isActive: boolean;
  isOpponent?: boolean;
}

const MAX_TREASURES = 2;

export function PlayerCard({ avatarSrc, score, isActive, isOpponent = false }: PlayerCardProps) {
  return (
    <div className={`player-card ${isActive ? 'active-turn' : ''} ${!isActive && isOpponent ? 'grayed-out' : ''}`}>
      <img src={avatarSrc} alt="Player avatar" className="player-avatar" />

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
