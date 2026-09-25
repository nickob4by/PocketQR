import React, { useState, useMemo } from 'react';
import type { ActivityLogItem, LogActionType } from '../types/qr';
import { triggerHaptic } from '../lib/security';

interface LogsViewProps {
  logs: ActivityLogItem[];
  onDeleteLog: (id: string) => void;
  onClearAllLogs: () => void;
  onRePay: (rawPayload: string) => void;
}

type FilterCategory = 'all' | 'payments' | 'saved_copied' | 'vault';

export const LogsView: React.FC<LogsViewProps> = ({
  logs,
  onDeleteLog,
  onClearAllLogs,
  onRePay,
}) => {
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (currentFilter === 'payments') {
        return log.type === 'dispatch_payment';
      }
      if (currentFilter === 'saved_copied') {
        return log.type === 'saved_photo' || log.type === 'copied_details';
      }
      if (currentFilter === 'vault') {
        return (
          log.type === 'card_added' ||
          log.type === 'card_updated' ||
          log.type === 'card_deleted'
        );
      }
      return true;
    });
  }, [logs, currentFilter]);

  const counts = useMemo(() => {
    return {
      all: logs.length,
      payments: logs.filter((l) => l.type === 'dispatch_payment').length,
      saved_copied: logs.filter(
        (l) => l.type === 'saved_photo' || l.type === 'copied_details'
      ).length,
      vault: logs.filter(
        (l) =>
          l.type === 'card_added' ||
          l.type === 'card_updated' ||
          l.type === 'card_deleted'
      ).length,
    };
  }, [logs]);

  const formatTimestamp = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const getActionBadge = (type: LogActionType) => {
    switch (type) {
      case 'dispatch_payment':
        return {
          icon: 'bolt',
          label: 'PAYMENT DISPATCHED',
          bg: 'bg-primary-container text-on-primary-container border-primary/30',
        };
      case 'saved_photo':
        return {
          icon: 'add_photo_alternate',
          label: 'SAVED TO PHOTOS',
          bg: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
        };
      case 'copied_details':
        return {
          icon: 'content_copy',
          label: 'COPIED DETAILS',
          bg: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
        };
      case 'card_added':
        return {
          icon: 'add_card',
          label: 'CARD ADDED',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        };
      case 'card_updated':
        return {
          icon: 'edit_note',
          label: 'CARD UPDATED',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
        };
      case 'card_deleted':
        return {
          icon: 'delete',
          label: 'CARD DELETED',
          bg: 'bg-error-container/30 text-error border-error/30',
        };
      default:
        return {
          icon: 'info',
          label: 'ACTIVITY',
          bg: 'bg-surface-container text-on-surface border-outline-variant/30',
        };
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Top Header Controls: Filter Chips & Clear Action */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x flex-nowrap shrink-0 no-scrollbar py-1">
          <button
            onClick={() => {
              setCurrentFilter('all');
              triggerHaptic('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              currentFilter === 'all'
                ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#006843]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
            }`}
          >
            ALL ({counts.all})
          </button>

          <button
            onClick={() => {
              setCurrentFilter('payments');
              triggerHaptic('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              currentFilter === 'payments'
                ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#006843]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
            }`}
          >
            PAYMENTS ({counts.payments})
          </button>

          <button
            onClick={() => {
              setCurrentFilter('saved_copied');
              triggerHaptic('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              currentFilter === 'saved_copied'
                ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#006843]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
            }`}
          >
            SAVED ({counts.saved_copied})
          </button>

          <button
            onClick={() => {
              setCurrentFilter('vault');
              triggerHaptic('light');
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
              currentFilter === 'vault'
                ? 'bg-primary-container text-on-primary-container shadow-[0_2px_0_0_#006843]'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
            }`}
          >
            VAULT ({counts.vault})
          </button>
        </div>

        {/* Clear History Button */}
        {logs.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-[10px] text-outline hover:text-error transition-colors px-2 py-1 rounded border border-outline-variant/30 hover:border-error/40 flex items-center gap-1 cursor-pointer ml-auto"
            title="Clear all activity logs"
          >
            <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
            <span>CLEAR ALL</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Clear All */}
      {showClearConfirm && (
        <div className="p-3 rounded-xl bg-surface-container-high border border-error/40 shadow-xl flex flex-col gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-error font-bold text-xs">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>WIPE ACTIVITY LOGS?</span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-sans">
            This will permanently remove all {logs.length} logged activities from your local device.
          </p>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded text-xs text-on-surface bg-surface-container hover:bg-surface-container-highest cursor-pointer"
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                onClearAllLogs();
                setShowClearConfirm(false);
                triggerHaptic('warning');
              }}
              className="px-3 py-1 rounded text-xs font-bold text-on-error bg-error hover:bg-error/90 cursor-pointer"
            >
              CONFIRM WIPE
            </button>
          </div>
        </div>
      )}

      {/* Log Feed Deck */}
      {filteredLogs.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {filteredLogs.map((log) => {
            const badge = getActionBadge(log.type);
            return (
              <div
                key={log.id}
                className="relative bg-surface-container-high rounded-xl p-3 shadow-[0_2px_0_0_#0b0e15] border border-outline-variant/30 flex flex-col gap-2 group/log"
              >
                {/* Header Row: Badge & Timestamp */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.bg}`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {badge.icon}
                      </span>
                      <span>{badge.label}</span>
                    </span>

                    {log.bank && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-tertiary font-bold uppercase tracking-wider border border-outline-variant/20 shrink-0">
                        {log.bank}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-outline">
                      {formatTimestamp(log.timestamp)}
                    </span>

                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="text-outline hover:text-error p-0.5 transition-colors cursor-pointer"
                      title="Delete log entry"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </div>
                </div>

                {/* Body Row: Payee/Title & Target App details */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-md text-on-surface font-bold text-sm sm:text-base tracking-tight truncate">
                      {log.title}
                    </span>

                    <div className="flex items-center gap-2 text-[11px] text-outline mt-0.5 flex-wrap">
                      {log.targetApp && (
                        <span className="text-primary-fixed flex items-center gap-0.5 font-medium">
                          <span className="material-symbols-outlined text-[13px]">
                            launch
                          </span>
                          <span>Via {log.targetApp}</span>
                        </span>
                      )}

                      {log.detail && (
                        <span>{log.detail}</span>
                      )}

                      {log.rail && (
                        <span className="text-[10px] px-1 rounded bg-surface-container-lowest border border-outline-variant/20">
                          {log.rail}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1-Tap Re-pay Action for Dispatched Payments */}
                  {log.type === 'dispatch_payment' && log.rawPayload && (
                    <button
                      onClick={() => onRePay(log.rawPayload!)}
                      className="px-2.5 py-1 bg-primary text-on-primary rounded font-bold hover:bg-primary-fixed cursor-pointer text-[10px] active:translate-y-0.5 transition-transform flex items-center gap-1 shrink-0"
                      title="Route payment to this payee again"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        replay
                      </span>
                      <span>RE-PAY</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center font-mono space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary-fixed shadow-inner">
            <span className="material-symbols-outlined text-[28px]">
              receipt_long
            </span>
          </div>

          <h3 className="font-headline-md text-headline-md text-on-surface font-bold uppercase">
            NO LOGS RECORDED
          </h3>
          <p className="text-xs text-outline max-w-xs font-sans leading-relaxed">
            {currentFilter !== 'all'
              ? `No activity found under the "${currentFilter.toUpperCase()}" filter.`
              : 'Payments dispatched through Scan to Pay, saved QR photos, and vault card changes will appear here automatically.'}
          </p>

          <div className="pt-2">
            <span className="font-label-sm text-[10px] text-primary bg-surface-container-high px-2 py-1 rounded border border-primary/30">
              OFFLINE LOCAL LEDGER // PRIVACY SECURED
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
