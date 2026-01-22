import { useState } from 'react';
import { Position, GRID_SIZE, CellState, ScannedArea, CompassResult, PowerType, ActiveAction } from '../../types/game';

interface GameGridProps {
  myTreasures?: Position[];
  dugCells?: (Position & { found: boolean; isMine: boolean })[];
  selectedCells?: Position[];
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  showTreasures?: boolean;
  diggingCell?: Position | null;
  activeAction?: ActiveAction | null;
  scannedArea?: ScannedArea | null;
  compassResult?: CompassResult | null;
  selectedAction?: PowerType;
}

const actionIcons: Partial<Record<PowerType, string>> = {
  dig: '/images/dig.png',
  detector: '/images/radar.png',
  compass: '/images/compass.png',
  trap: '/images/trap.png',
  shovel: '/images/golden_shovel.png',
};

export function GameGrid({
  myTreasures = [],
  dugCells = [],
  selectedCells = [],
  clickable = false,
  onCellClick,
  showTreasures = false,
  diggingCell = null,
  activeAction = null,
  scannedArea = null,
  compassResult = null,
  selectedAction = 'dig',
}: GameGridProps) {
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

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

  const isInScannedArea = (x: number, y: number): boolean => {
    if (!scannedArea) return false;
    return scannedArea.cells.some((c) => c.x === x && c.y === y);
  };

  const isScannedCenter = (x: number, y: number): boolean => {
    if (!scannedArea) return false;
    return scannedArea.center.x === x && scannedArea.center.y === y;
  };

  const isCompassCell = (x: number, y: number): boolean => {
    if (!compassResult) return false;
    return compassResult.position.x === x && compassResult.position.y === y;
  };

  const isHovered = (x: number, y: number): boolean => {
    return hoveredCell?.x === x && hoveredCell?.y === y;
  };

  // Check if cell is in the preview area for detector (3x3 around hovered cell)
  const isInDetectorPreview = (x: number, y: number): boolean => {
    if (!clickable || !hoveredCell || selectedAction !== 'detector') return false;
    const dx = Math.abs(x - hoveredCell.x);
    const dy = Math.abs(y - hoveredCell.y);
    return dx <= 1 && dy <= 1;
  };

  // Check if this cell has an active action in progress
  const isActiveActionCell = (x: number, y: number): boolean => {
    return activeAction?.position.x === x && activeAction?.position.y === y;
  };

  return (
    <div className="game-grid">
      {Array.from({ length: GRID_SIZE }, (_, y) =>
        Array.from({ length: GRID_SIZE }, (_, x) => {
          const state = getCellState(x, y);
          const key = `${x}-${y}`;
          const isDigging = diggingCell?.x === x && diggingCell?.y === y;
          const hasActiveAction = isActiveActionCell(x, y);
          const dugCell = dugCells.find((p) => p.x === x && p.y === y);
          const inScannedArea = isInScannedArea(x, y);
          const scannedCenter = isScannedCenter(x, y);
          const cellHovered = isHovered(x, y);
          const inDetectorPreview = isInDetectorPreview(x, y);

          const isMine = dugCell?.isMine ?? false;
          const digOwnerClass = dugCell ? (isMine ? 'dug-mine' : 'dug-opponent') : '';
          const scannedClass = inScannedArea ? 'scanned' : '';
          const detectorPreviewClass = inDetectorPreview ? 'detector-preview' : '';
          const activeActionClass = hasActiveAction ? 'action-in-progress' : '';
          const compassCell = isCompassCell(x, y);
          const compassClass = compassCell ? 'compass-result' : '';

          // Show action preview on hover (only for clickable cells that aren't already dug or have active action)
          const showActionPreview = clickable && cellHovered && !dugCell && !hasActiveAction;

          return (
            <div
              key={key}
              className={`grid-cell ${state} ${digOwnerClass} ${clickable ? 'clickable' : 'disabled'} ${isDigging ? 'digging-pulse' : ''} ${dugCell?.found ? 'found' : ''} ${scannedClass} ${detectorPreviewClass} ${activeActionClass} ${compassClass}`}
              onClick={() => handleCellClick(x, y)}
              onMouseEnter={() => clickable && setHoveredCell({ x, y })}
              onMouseLeave={() => setHoveredCell(null)}
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
              {/* Active action indicator - shows the action icon while executing */}
              {hasActiveAction && activeAction && actionIcons[activeAction.type] && (
                <img
                  src={actionIcons[activeAction.type]}
                  alt={activeAction.type}
                  className="active-action-indicator"
                />
              )}
              {/* Scanned area result badge on center cell */}
              {scannedCenter && scannedArea && (
                <div className="scan-result-badge">{scannedArea.result}</div>
              )}
              {/* Compass result badge */}
              {compassCell && compassResult && (
                <div className="compass-result-badge">{compassResult.distance}</div>
              )}
              {/* Action preview on hover */}
              {showActionPreview && actionIcons[selectedAction] && (
                <img
                  src={actionIcons[selectedAction]}
                  alt={selectedAction}
                  className="action-preview"
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
