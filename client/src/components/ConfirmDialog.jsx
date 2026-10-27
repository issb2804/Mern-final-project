import { Modal, Spinner } from './ui';

export default function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Delete', pending }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-ink-600">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-danger" onClick={onConfirm} disabled={pending}>
          {pending && <Spinner className="h-4 w-4 text-on-accent" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
