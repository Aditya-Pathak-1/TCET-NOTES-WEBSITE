import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
  danger       = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal p-6" onClick={e => e.stopPropagation()}>
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto
          ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          <span className="text-2xl">{danger ? '🗑️' : '⚠️'}</span>
        </div>

        <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
