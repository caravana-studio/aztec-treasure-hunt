interface PlayerCardProps {
  avatarSrc: string;
  score: number;
  isActive: boolean;
  isOpponent?: boolean;
}

export function PlayerCard({ avatarSrc, score, isActive, isOpponent = false }: PlayerCardProps) {
  return (
    <div className={`player-card ${!isActive && isOpponent ? 'grayed-out' : ''}`}>
      <img src={avatarSrc} alt="Player avatar" className="player-avatar" />
      <div className="player-score-badge">
        <img src="/images/treasure.png" alt="Treasures found" />
        <span className="score-count">{score}</span>
      </div>
    </div>
  );
}
