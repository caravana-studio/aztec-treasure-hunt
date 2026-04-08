import { useState } from 'react';
import { Position, GRID_SIZE, CellState, ScannedArea, CompassResult, PowerType, ActiveAction, DugCell } from '../../types/game';
import '../../styles/tooltip.css';

interface GameGridProps {
  myTreasures?: Position[];
  myTraps?: Position[];
  dugCells?: DugCell[];
  selectedCells?: Position[];
  isTreasureSelectionMode?: boolean;
  clickable?: boolean;
  onCellClick?: (x: number, y: number) => void;
  showTreasures?: boolean;
  diggingCell?: Position | null;
  activeAction?: ActiveAction | null;
  scannedArea?: ScannedArea | null;
  compassResult?: CompassResult | null;
  selectedAction?: PowerType;
  shovelSourcePosition?: Position | null;
}

const actionIcons: Partial<Record<PowerType, string>> = {
  dig: '/images/dig.png',
  detector: '/images/radar.png',
  compass: '/images/compass.png',
  trap: '/images/trap.png',
  shovel: '/images/golden_shovel.png',
};

// Tooltip messages for actions on cells
const getActionTooltip = (
  action: PowerType,
  x: number,
  y: number,
  context: {
    isTreasureSelection: boolean;
    isAlreadySelected: boolean;
    isDug: boolean;
    dugByMe: boolean;
    isShovelMode: boolean;
    shovelSourceSelected: boolean;
    isMyTreasure: boolean;
    hasTrap: boolean;
  }
): { title: string; description: string } | null => {
  const pos = `(${x}, ${y})`;

  // During treasure placement setup
  if (context.isTreasureSelection) {
    if (context.isAlreadySelected) {
      return { title: 'Remove Treasure', description: `Click to remove treasure from position ${pos}` };
    }
    return { title: 'Place Treasure', description: `Click to hide your treasure at position ${pos}` };
  }

  // Cell already dug
  if (context.isDug) {
    if (context.dugByMe) {
      return { title: 'Already Dug', description: 'You already excavated this cell' };
    }
    return { title: 'Opponent Dug', description: 'Your opponent excavated this cell' };
  }

  // Shovel action
  if (action === 'shovel') {
    if (!context.shovelSourceSelected) {
      if (context.isMyTreasure) {
        return { title: 'Select Treasure', description: `Click to select this treasure to move from ${pos}` };
      }
      return { title: 'Golden Shovel', description: 'First, click on one of your treasures to move it' };
    } else {
      if (context.isMyTreasure) {
        return { title: 'Invalid Target', description: 'Cannot move here - this cell already has a treasure' };
      }
      return { title: 'Move Treasure', description: `Click to secretly move your treasure to ${pos}` };
    }
  }

  // Trap action
  if (action === 'trap') {
    if (context.hasTrap) {
      return { title: 'Trap Placed', description: `You already have a trap at ${pos}` };
    }
    return { title: 'Place Trap', description: `Click to set a hidden trap at ${pos}` };
  }

  // Detector action
  if (action === 'detector') {
    return { title: 'Scan Area', description: `Click to scan the 3x3 area centered on ${pos}` };
  }

  // Compass action
  if (action === 'compass') {
    return { title: 'Use Compass', description: `Click to find distance to nearest treasure from ${pos}` };
  }

  // Default dig action
  return { title: 'Dig', description: `Click to excavate at position ${pos}` };
};

export function GameGrid({
  myTreasures = [],
  myTraps = [],
  dugCells = [],
  selectedCells = [],
  isTreasureSelectionMode = false,
  clickable = false,
  onCellClick,
  showTreasures = false,
  diggingCell = null,
  activeAction = null,
  scannedArea = null,
  compassResult = null,
  selectedAction = 'dig',
  shovelSourcePosition = null,
}: GameGridProps) {
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<{ title: string; description: string } | null>(null);

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

  const handleMouseMove = (e: React.MouseEvent, tooltip: { title: string; description: string } | null) => {
    if (clickable && tooltip) {
      setTooltipPos({ x: e.clientX, y: e.clientY - 10 });
      setTooltipData(tooltip);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
    setTooltipPos(null);
    setTooltipData(null);
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

  // Shovel mode helpers
  const isShovelSource = (x: number, y: number): boolean => {
    return shovelSourcePosition?.x === x && shovelSourcePosition?.y === y;
  };

  const isShovelSelectable = (x: number, y: number): boolean => {
    if (!clickable || selectedAction !== 'shovel') return false;
    // If no source selected, treasures are selectable
    if (!shovelSourcePosition) {
      return myTreasures.some((t) => t.x === x && t.y === y);
    }
    return false;
  };

  const isShovelTarget = (x: number, y: number): boolean => {
    if (!clickable || selectedAction !== 'shovel' || !shovelSourcePosition) return false;
    // Valid target: not dug, not a treasure, not the source itself
    const isDug = dugCells.some((d) => d.x === x && d.y === y);
    const isTreasure = myTreasures.some((t) => t.x === x && t.y === y);
    return !isDug && !isTreasure;
  };

  // Check if cell has a trap placed by the player
  const hasMyTrap = (x: number, y: number): boolean => {
    return myTraps.some((t) => t.x === x && t.y === y);
  };

  return (
    <>
      {/* Custom tooltip */}
      {tooltipPos && tooltipData && (
        <div
          className="custom-tooltip"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="tooltip-content">
            <div className="tooltip-title">{tooltipData.title}</div>
            <div className="tooltip-divider" />
            <div className="tooltip-description">{tooltipData.description}</div>
          </div>
          <div className="tooltip-arrow" />
        </div>
      )}

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
          const trapTriggeredClass = dugCell?.hitTrap ? 'dug-trap' : '';
          const scannedClass = inScannedArea ? 'scanned' : '';
          const detectorPreviewClass = inDetectorPreview ? 'detector-preview' : '';
          const activeActionClass = hasActiveAction ? 'action-in-progress' : '';
          const compassCell = isCompassCell(x, y);
          const compassClass = compassCell ? 'compass-result' : '';
          const shovelSource = isShovelSource(x, y);
          const shovelSelectable = isShovelSelectable(x, y);
          const shovelTarget = isShovelTarget(x, y);
          const shovelSourceClass = shovelSource ? 'shovel-source' : '';
          const shovelSelectableClass = shovelSelectable ? 'shovel-selectable' : '';
          const shovelTargetClass = shovelTarget ? 'shovel-target' : '';
          const cellHasTrap = hasMyTrap(x, y);
          const trapClass = cellHasTrap ? 'has-trap' : '';
          // Check if this is my own treasure (even if dug)
          const isMyTreasure = showTreasures && myTreasures.some((t) => t.x === x && t.y === y);

          // Show action preview on hover (only during gameplay, not during treasure selection setup)
          const isTreasureSelection = isTreasureSelectionMode;
          // Show preview on all cells except those dug by me (opponent's dug cells can still show preview)
          const canShowPreview = !dugCell || !dugCell.isMine;
          const showActionPreview = clickable && cellHovered && canShowPreview && !hasActiveAction && !isTreasureSelection;
          // Show treasure preview on hover during setup (when selecting treasure positions)
          const isAlreadySelected = selectedCells.some((p) => p.x === x && p.y === y);
          const showTreasurePreview = clickable && cellHovered && isTreasureSelection && !isAlreadySelected;

          // Generate tooltip for the cell
          const cellTooltip = clickable
            ? getActionTooltip(selectedAction, x, y, {
                isTreasureSelection,
                isAlreadySelected,
                isDug: !!dugCell,
                dugByMe: dugCell?.isMine ?? false,
                isShovelMode: selectedAction === 'shovel',
                shovelSourceSelected: !!shovelSourcePosition,
                isMyTreasure,
                hasTrap: cellHasTrap,
              })
            : null;

          return (
            <div
              key={key}
              className={`grid-cell ${state} ${digOwnerClass} ${trapTriggeredClass} ${clickable ? 'clickable' : 'disabled'} ${isDigging ? 'digging-pulse' : ''} ${dugCell?.found ? 'found' : ''} ${scannedClass} ${detectorPreviewClass} ${activeActionClass} ${compassClass} ${shovelSourceClass} ${shovelSelectableClass} ${shovelTargetClass} ${trapClass}`}
              onClick={() => handleCellClick(x, y)}
              onMouseEnter={() => clickable && setHoveredCell({ x, y })}
              onMouseMove={(e) => handleMouseMove(e, cellTooltip)}
              onMouseLeave={handleMouseLeave}
            >
              {state === 'selected' && (
                <img src="/images/treasure.png" alt="Selected treasure" className="cell-content" style={{ opacity: 0.8 }} />
              )}
              {state === 'dug-found' && !isMyTreasure && (
                <img src="/images/treasure.png" alt="Treasure" className="cell-content" />
              )}
              {(state === 'your-treasure' || (isMyTreasure && dugCell)) && (
                <img src="/images/treasure.png" alt="Your treasure" className="cell-content" style={{ opacity: 0.7 }} />
              )}
              {/* Show trap indicator for cells where player placed traps (not yet triggered) */}
              {cellHasTrap && !dugCell && (
                <img src="/images/trap.png" alt="Your trap" className="cell-content trap-placed" />
              )}
              {/* Show trap icon when opponent hit a trap */}
              {dugCell?.hitTrap && (
                <img src="/images/trap.png" alt="Trap triggered" className="cell-content" />
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
              {/* Treasure preview on hover during setup */}
              {showTreasurePreview && (
                <img
                  src="/images/treasure.png"
                  alt="Place treasure here"
                  className="action-preview"
                />
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
    </>
  );
}
