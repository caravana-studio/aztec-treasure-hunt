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

  let statusLabel: React.ReactNode;
  if (isProving && phase) {
    statusLabel = (
      <span className="accelerator-badge__status accelerator-badge__status--warm">
        {PHASE_LABEL[phase] ?? phase}
      </span>
    );
  } else if (isNative) {
    statusLabel = (
      <>
        <span className="accelerator-badge__status accelerator-badge__status--native">
          Native
        </span>
        {lastProofMs && (
          <span className="accelerator-badge__time">{(lastProofMs / 1000).toFixed(1)}s</span>
        )}
      </>
    );
  } else if (available) {
    statusLabel = (
      <span className="accelerator-badge__status accelerator-badge__status--warm">
        WASM
      </span>
    );
  } else {
    statusLabel = (
      <span className="accelerator-badge__status accelerator-badge__status--warm">
        WASM
      </span>
    );
  }

  return (
    <div
      className={`accelerator-badge${isNative ? ' is-native' : ''}${isProving ? ' is-proving' : ''}`}
    >
      <span className="accelerator-badge__dot" />
      <span className="accelerator-badge__content">{statusLabel}</span>
      {available && (
        <button
          type="button"
          onClick={handleToggle}
          title={isNative ? 'Switch to WASM proving' : 'Switch to native proving'}
          className="accelerator-badge__toggle"
        >
          {isNative ? 'Use WASM' : 'Use Native'}
        </button>
      )}
    </div>
  );
}
