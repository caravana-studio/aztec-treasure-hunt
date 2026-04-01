import { useAcceleratorStore } from '../../store/accelerator';
import { getAcceleratorProver } from '../../wallet/connectors/EmbeddedConnector';

const PHASE_LABEL: Record<string, string> = {
  detect: 'Detecting...',
  transmit: 'Sending to native...',
  proving: 'Proving...',
  proved: 'Done',
  receive: 'Receiving proof...',
  fallback: 'Falling back to WASM...',
  denied: 'Denied, using WASM...',
};

export function AcceleratorBadge() {
  const { available, mode, phase, lastProofMs, setMode } = useAcceleratorStore();

  const isProving = phase !== null && phase !== 'proved';
  const isNative = mode === 'accelerated' && available;

  const handleToggle = () => {
    const next = mode === 'accelerated' ? 'wasm' : 'accelerated';
    setMode(next);
    getAcceleratorProver()?.setForceLocal(next === 'wasm');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.07)',
        border: `1px solid ${isNative ? 'rgba(99,255,180,0.3)' : 'rgba(255,200,80,0.3)'}`,
        fontSize: '12px',
        color: 'rgba(255,255,255,0.85)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Status dot */}
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: isProving
            ? '#f0c040'
            : isNative
            ? '#63ffb4'
            : '#f0c040',
          boxShadow: isProving
            ? '0 0 6px #f0c040'
            : isNative
            ? '0 0 6px #63ffb4'
            : 'none',
          flexShrink: 0,
          animation: isProving ? 'pulse 1s infinite' : 'none',
        }}
      />

      {/* Label */}
      <span style={{ whiteSpace: 'nowrap' }}>
        {isProving && phase ? (
          <span style={{ color: '#f0c040' }}>{PHASE_LABEL[phase] ?? phase}</span>
        ) : isNative ? (
          <>
            <span style={{ color: '#63ffb4', fontWeight: 600 }}>⚡ Native</span>
            {lastProofMs && (
              <span style={{ opacity: 0.6, marginLeft: '4px' }}>
                {(lastProofMs / 1000).toFixed(1)}s
              </span>
            )}
          </>
        ) : available ? (
          <span style={{ color: '#f0c040' }}>🌐 WASM (forced)</span>
        ) : (
          <span style={{ color: '#f0c040' }}>🌐 WASM</span>
        )}
      </span>

      {/* Toggle — only show when native accelerator is available */}
      {available && (
        <button
          onClick={handleToggle}
          title={isNative ? 'Switch to WASM proving' : 'Switch to native proving'}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px 7px',
            lineHeight: 1.4,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.background = 'rgba(255,255,255,0.18)')
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)')
          }
        >
          {isNative ? 'Use WASM' : 'Use Native'}
        </button>
      )}
    </div>
  );
}
