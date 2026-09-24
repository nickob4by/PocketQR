import React from 'react';

interface HeaderProps {
  onScanToPayClick: () => void;
  onAddClick: () => void;
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  privacyMask: boolean;
  onTogglePrivacyMask: () => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  cardCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onAddClick,
  searchQuery,
  onSearchChange,
  privacyMask,
  onTogglePrivacyMask,
  isSearchOpen,
  onToggleSearch,
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

          {/* Quick Action Controls */}
          <div className="flex items-center gap-1.5">
            {/* Search Toggle */}
            <button
              onClick={onToggleSearch}
              aria-label="Search ROMs"
              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                isSearchOpen
                  ? 'bg-primary-container/20 border-primary-fixed text-primary-fixed'
                  : 'bg-surface-container-high border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>

            {/* Privacy Mask Toggle */}
            <button
              onClick={onTogglePrivacyMask}
              aria-label={privacyMask ? 'Show numbers' : 'Mask numbers'}
              title={privacyMask ? 'Numbers masked' : 'Numbers visible'}
              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                privacyMask
                  ? 'bg-surface-container-high border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                  : 'bg-secondary/20 border-secondary text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {privacyMask ? 'visibility_off' : 'visibility'}
              </span>
            </button>

            {/* ADD ROM CTA */}
            <button
              onClick={onAddClick}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface-container-high border border-primary-fixed-dim text-primary-fixed font-label-sm text-label-sm rounded-lg shadow-[0_2px_0_0_#0b0e15] active:translate-y-0.5 transition-transform uppercase font-bold tracking-wider hover:text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>ADD ROM</span>
            </button>
          </div>
        </div>

        {/* Expandable Search Input Bar */}
        {isSearchOpen && (
          <div className="mt-2 pt-2 border-t border-outline-variant/30 animate-in fade-in duration-150">
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Search ROMs, payee, or account..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/80 rounded-lg pl-9 pr-9 py-2 text-xs font-label-md text-on-surface placeholder-outline focus:outline-none focus:border-primary-fixed transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-label-sm text-outline hover:text-on-surface bg-surface-container-high px-1.5 py-0.5 rounded"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
