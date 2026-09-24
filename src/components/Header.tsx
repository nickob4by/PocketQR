import React from 'react';

interface HeaderProps {
  onScanToPayClick?: () => void;
  onAddClick: () => void;
  onSettingsClick?: () => void;
  cardCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onAddClick,
  cardCount,
}) => {
  return (
    <header className="sticky top-0 w-full z-40 pt-safe bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/40 shadow-[0_1px_8px_rgba(0,0,0,0.5)] transition-all">
      <div className="max-w-md mx-auto px-margin py-2.5 flex flex-col gap-1">
        {/* Top Hardware Telemetry Strip */}
        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
          <div className="flex items-center gap-space-xs">
            <span className="text-primary-fixed">SYS://ONLINE</span>
            <span className="text-outline">|</span>
            <span className="text-tertiary tracking-widest">BAT [||||]</span>
          </div>
          <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
            <span className="tracking-wider">LIVE-LINK</span>
          </div>
        </div>

        {/* Main Branding & Action Row */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-primary-fixed-dim/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[18px]">developer_board</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-headline-md tracking-tight text-primary-fixed uppercase font-bold">
                  POCKET•QR
                </span>
                <span className="font-label-sm text-label-sm text-outline px-1 rounded-DEFAULT bg-surface-container-low">
                  v1.0
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                ROM VAULT // {cardCount} {cardCount === 1 ? 'SLOT' : 'SLOTS'}
              </span>
            </div>
          </div>

          {/* Quick Action Controls: Clean Add Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAddClick}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-high border border-primary-fixed-dim text-primary-fixed font-label-sm text-label-sm rounded-lg shadow-[0_2px_0_0_#0b0e15] active:translate-y-0.5 transition-transform uppercase font-bold tracking-wider hover:text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>ADD ROM</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
