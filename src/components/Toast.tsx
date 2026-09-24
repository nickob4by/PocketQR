import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-4 right-4 max-w-md mx-auto z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.type === 'success'
              ? 'bg-surface-container-highest/95 border-primary-fixed-dim/50 text-on-surface shadow-[0_8px_24px_rgba(0,240,160,0.2)]'
              : toast.type === 'error'
              ? 'bg-surface-container-highest/95 border-error/50 text-on-surface shadow-[0_8px_24px_rgba(255,180,171,0.2)]'
              : 'bg-surface-container-highest/95 border-tertiary-fixed-dim/50 text-on-surface shadow-[0_8px_24px_rgba(71,214,255,0.2)]'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${
                toast.type === 'success'
                  ? 'text-primary-fixed'
                  : toast.type === 'error'
                  ? 'text-error'
                  : 'text-tertiary-fixed'
              }`}
            >
              {toast.type === 'success'
                ? 'check_circle'
                : toast.type === 'error'
                ? 'error'
                : 'info'}
            </span>

            <div className="flex-1 min-w-0">
              <h4 className="font-headline-md text-headline-md text-[13px] font-bold uppercase tracking-tight text-on-surface">
                {toast.title}
              </h4>
              {toast.description && (
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 break-words">
                  {toast.description}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
