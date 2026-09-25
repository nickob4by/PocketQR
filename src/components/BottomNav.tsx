import React from 'react';

export type NavTab = 'vault' | 'logs' | 'scan' | 'rails' | 'config';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onScanClick: () => void;
  onConfigClick: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onScanClick,
  onConfigClick,
}) => {
  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-4px_16px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between h-20 px-gutter max-w-md mx-auto">
        {/* VAULT TAB */}
        <button
          onClick={() => onTabChange('vault')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-space-xs py-1 rounded-lg transition-transform active:translate-y-0.5 ${
            currentTab === 'vault'
              ? 'bg-surface-container-high text-primary-fixed-dim'
              : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
          <span className="font-label-sm text-label-sm uppercase mt-0.5 font-bold">VAULT</span>
        </button>

        {/* LOGS TAB */}
        <button
          onClick={() => onTabChange('logs')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-space-xs py-1 rounded-lg transition-transform active:translate-y-0.5 ${
            currentTab === 'logs'
              ? 'bg-surface-container-high text-primary-fixed-dim'
              : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          <span className="font-label-sm text-label-sm uppercase mt-0.5 font-bold">LOGS</span>
        </button>

        {/* ELEVATED SCAN BUTTON */}
        <button
          onClick={onScanClick}
          aria-label="Scan to Pay"
          className="relative -top-3 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-fixed shadow-[0_0_22px_var(--theme-glow,rgba(0,240,160,0.5))] border-2 border-primary-fixed-dim transition-transform active:translate-y-0.5 flex-shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[28px] font-bold text-on-primary">
            qr_code_scanner
          </span>
          <span className="font-label-sm text-[8px] leading-tight uppercase font-bold tracking-widest text-on-primary mt-0.5">
            SCAN
          </span>
        </button>

        {/* RAILS (BANKING RAILS) TAB */}
        <button
          onClick={() => onTabChange('rails')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-space-xs py-1 rounded-lg transition-transform active:translate-y-0.5 ${
            currentTab === 'rails'
              ? 'bg-surface-container-high text-primary-fixed-dim'
              : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">developer_board</span>
          <span className="font-label-sm text-label-sm uppercase mt-0.5 font-bold">RAILS</span>
        </button>

        {/* CONFIG / SETTINGS TAB */}
        <button
          onClick={() => {
            onConfigClick();
          }}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-space-xs py-1 rounded-lg transition-transform active:translate-y-0.5 ${
            currentTab === 'config'
              ? 'bg-surface-container-high text-primary-fixed-dim'
              : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span className="font-label-sm text-label-sm uppercase mt-0.5 font-bold">CONFIG</span>
        </button>
      </div>
    </nav>
  );
};
