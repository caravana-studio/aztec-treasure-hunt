import { GameLog } from '../../types/game';

interface GameLogsProps {
  logs: GameLog[];
}

// Parse and highlight important parts of log messages
function formatLogMessage(message: string): JSX.Element {
  // Define patterns and their corresponding styles
  const patterns: { regex: RegExp; className: string }[] = [
    { regex: /found a treasure/gi, className: 'log-success' },
    { regex: /found nothing/gi, className: 'log-neutral' },
    { regex: /hit a trap|hit your trap|lose.*turn/gi, className: 'log-danger' },
    { regex: /extra turn/gi, className: 'log-warning' },
    { regex: /\((\d+),\s*(\d+)\)/g, className: 'log-position' },
    { regex: /\d+ treasures?/gi, className: 'log-info' },
    { regex: /\d+ cells? away/gi, className: 'log-info' },
    { regex: /^You /g, className: 'log-you' },
    { regex: /^Opponent /g, className: 'log-opponent' },
  ];

  // Split message into parts and apply formatting
  let result: (string | JSX.Element)[] = [message];

  patterns.forEach(({ regex, className }) => {
    result = result.flatMap((part, partIndex) => {
      if (typeof part !== 'string') return part;

      const pieces: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      let match;

      // Reset regex lastIndex for global patterns
      regex.lastIndex = 0;

      while ((match = regex.exec(part)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          pieces.push(part.slice(lastIndex, match.index));
        }
        // Add highlighted match
        pieces.push(
          <span key={`${partIndex}-${match.index}`} className={className}>
            {match[0]}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < part.length) {
        pieces.push(part.slice(lastIndex));
      }

      return pieces.length > 0 ? pieces : [part];
    });
  });

  return <>{result}</>;
}

export function GameLogs({ logs }: GameLogsProps) {
  return (
    <div className="logs-panel-glass">
      <div className="logs-header-glass">
        <span>Game Log</span>
      </div>
      <div className="logs-content-glass">
        <div className="logs-list-glass">
          {logs.length === 0 ? (
            <div className="log-entry-glass log-empty">No activity yet.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="log-entry-glass">
                <span className="log-message">{formatLogMessage(log.message)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
