import { PowerType } from '../../types/game';

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

const powerTooltips: Record<PowerType, string> = {
  dig: 'Dig at a cell to find treasure',
  shovel: 'Golden Shovel: Move one of your treasures to a new location',
  detector: 'Radar: Scan a 3x3 area to count hidden treasures',
  compass: 'Compass: Get the distance to the nearest treasure',
  trap: 'Trap: Place a trap that makes opponent skip a turn',
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
  const items: PowerItem[] = powerOrder.map((type) => ({
    type,
    icon: powerIcons[type],
    count: powers[type],
  }));

  return (
    <div className={`objects-panel-glass ${isOpponent ? 'grayed-out' : ''}`}>
      <div className="objects-panel-header">Objects</div>
      <div className="objects-panel-content">
        {/* Dig action - primary, always available */}
        <button
          className={`dig-action-btn ${selectedAction === 'dig' ? 'selected' : ''}`}
          onClick={() => onSelectAction('dig')}
          disabled={disabled || isOpponent}
          title={powerTooltips['dig']}
        >
          <img src={powerIcons['dig']} alt="dig" />
          <span>Dig</span>
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
              title={powerTooltips[item.type]}
            >
              <img src={item.icon} alt={item.type} />
              <span className="power-badge">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
