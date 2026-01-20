import { Position, GRID_SIZE, CellState } from '../../types/game';

interface GameGridProps {
  myTreasures?: Position[];
  dugCells?: (Position & { found: boolean; isMine: boolean })[];
  selectedCells?: Position[];
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  showTreasures?: boolean;
  diggingCell?: Position | null;
}

export function GameGrid({
  myTreasures = [],
  dugCells = [],
  selectedCells = [],
  clickable = false,
  onCellClick,
  showTreasures = false,
  diggingCell = null,
}: GameGridProps) {

  const getCellState = (x: number, y: number): CellState => {
    if (selectedCells.some((p) => p.x === x && p.y === y)) {
      return 'selected';
    }
    const dugCell = dugCells.find((p) => p.x === x && p.y === y);
    if (dugCell) {
      return dugCell.found ? 'dug-found' : 'dug-empty';
    }
    if (showTreasures && myTreasures.some((p) => p.x === x && p.y === y)) {
      return 'your-treasure';
    }
    return 'normal';
  };

  const handleCellClick = (x: number, y: number) => {
    if (!clickable || !onCellClick) return;
    onCellClick(x, y);
  };

  return (
    <div className="game-grid">
      {Array.from({ length: GRID_SIZE }, (_, y) =>
        Array.from({ length: GRID_SIZE }, (_, x) => {
          const state = getCellState(x, y);
          const key = `${x}-${y}`;
          const isDigging = diggingCell?.x === x && diggingCell?.y === y;
          const dugCell = dugCells.find((p) => p.x === x && p.y === y);

          const isMine = dugCell?.isMine ?? false;
          const digOwnerClass = dugCell ? (isMine ? 'dug-mine' : 'dug-opponent') : '';

          return (
            <div
              key={key}
              className={`grid-cell ${state} ${digOwnerClass} ${clickable ? 'clickable' : 'disabled'} ${isDigging ? 'digging-pulse' : ''} ${dugCell?.found ? 'found' : ''}`}
              onClick={() => handleCellClick(x, y)}
            >
              {state === 'selected' && (
                <img src="/images/treasure.png" alt="Selected treasure" className="cell-content" style={{ opacity: 0.8 }} />
              )}
              {state === 'dug-found' && (
                <img src="/images/treasure.png" alt="Treasure" className="cell-content" />
              )}
              {state === 'your-treasure' && showTreasures && (
                <img src="/images/treasure.png" alt="Your treasure" className="cell-content" style={{ opacity: 0.7 }} />
              )}
              {isDigging && (
                <div className="digging-indicator">⛏️</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
