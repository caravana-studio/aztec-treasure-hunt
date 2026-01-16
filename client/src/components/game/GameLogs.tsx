import { useState } from 'react';
import { GameLog } from '../../types/game';

interface GameLogsProps {
  logs: GameLog[];
}

export function GameLogs({ logs }: GameLogsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="logs-panel">
      <div
        className={`logs-header ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Logs</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={`logs-content ${expanded ? 'expanded' : ''}`}>
        <div className="logs-list">
          {logs.length === 0 ? (
            <div className="log-entry">No activity yet...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="log-entry">
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
