import { useState } from 'react';
import { PowerType } from '../../types/game';
import '../../styles/tooltip.css';

interface PowerItem {
  type: PowerType;
  icon: string;
  count: number;
}

interface PowersPanelProps {
  powers: Record<PowerType, number>;
  selectedAction: PowerType;
  onSelectAction: (action: PowerType) => void;
  disabled?: boolean;
  isOpponent?: boolean;
}

const powerIcons: Record<PowerType, string> = {
  dig: '/images/dig.png',
  shovel: '/images/golden_shovel.png',
  detector: '/images/radar.png',
  compass: '/images/compass.png',
  trap: '/images/trap.png',
};

const powerInfo: Record<PowerType, { title: string; description: string }> = {
  dig: {
    title: 'Dig',
    description: 'Excavate a cell to search for hidden treasure. Your main action each turn.',
  },
  shovel: {
    title: 'Golden Shovel',
    description: 'Secretly move one of your treasures to a new location.',
  },
  detector: {
    title: 'Detector',
    description: 'Scan a 3x3 area to count how many treasures are hidden within.',
  },
  compass: {
    title: 'Compass',
    description: 'Reveals the Manhattan distance to the nearest unfound treasure.',
  },
  trap: {
    title: 'Trap',
    description: 'Place a hidden trap that makes your opponent lose their next turn.',
  },
};

// Special objects with limited uses
const powerOrder: PowerType[] = ['shovel', 'compass', 'detector', 'trap'];

export function PowersPanel({
  powers,
  selectedAction,
  onSelectAction,
  disabled = false,
  isOpponent = false,
}: PowersPanelProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<{ title: string; description: string } | null>(null);

  const items: PowerItem[] = powerOrder.map((type) => ({
    type,
    icon: powerIcons[type],
    count: powers[type],
  }));

  const handleMouseMove = (e: React.MouseEvent, powerType: PowerType) => {
    setTooltipPos({ x: e.clientX, y: e.clientY - 10 });
    setTooltipData(powerInfo[powerType]);
  };

  const handleMouseLeave = () => {
    setTooltipPos(null);
    setTooltipData(null);
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

      <div className="objects-panel-glass">
        <div className="objects-panel-header">
          <span>Objects</span>
        </div>
        <div className="objects-panel-content">
          {/* Dig action - primary, always available */}
          <button
            className={`dig-action-btn ${selectedAction === 'dig' ? 'selected' : ''}`}
            onClick={() => onSelectAction('dig')}
            disabled={disabled || isOpponent}
            onMouseMove={(e) => handleMouseMove(e, 'dig')}
            onMouseLeave={handleMouseLeave}
          >
            <img src={powerIcons['dig']} alt="dig" />
            <span>DIG</span>
          </button>

          {/* Divider */}
          <div className="objects-divider" />

          {/* Power items grid */}
          <div className="objects-items-grid">
            {items.map((item) => (
              <button
                key={item.type}
                className={`power-item-btn ${selectedAction === item.type ? 'selected' : ''}`}
                onClick={() => onSelectAction(item.type)}
                disabled={disabled || isOpponent || item.count === 0}
                onMouseMove={(e) => handleMouseMove(e, item.type)}
                onMouseLeave={handleMouseLeave}
              >
                <img src={item.icon} alt={item.type} />
                {!isOpponent && <span className="power-badge">{item.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
