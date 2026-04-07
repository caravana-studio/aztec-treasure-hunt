interface StatusModalProps {
  title: string;
  message: string;
  busy?: boolean;
}

export function StatusModal({ title, message, busy = true }: StatusModalProps) {
  return (
    <div className="menu-status-modal" aria-live="polite" aria-busy={busy}>
      <div className="menu-status-modal__dialog">
        {busy && <div className="loading-spinner" />}
        <p className="menu-status-modal__eyebrow">{title}</p>
        <p className="menu-status-modal__copy">{message}</p>
      </div>
    </div>
  );
}
