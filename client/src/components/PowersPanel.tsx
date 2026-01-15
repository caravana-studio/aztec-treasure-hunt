import { PowerType } from '../hooks/useGame';

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

// Objects: golden shovel, compass, radar, trap (dig is common action, not shown here)
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
    <div className={`objects-panel ${isOpponent ? 'grayed-out' : ''}`}>
      <div className="objects-header">Objects</div>
      <div className="objects-grid">
        {items.map((item) => (
          <button
            key={item.type}
            className={`power-btn ${selectedAction === item.type ? 'active' : ''}`}
            onClick={() => onSelectAction(item.type)}
            disabled={disabled || isOpponent || item.count === 0}
            title={item.type}
          >
            <img src={item.icon} alt={item.type} />
            <span className="badge">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
