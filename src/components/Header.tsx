import React from 'react';
import { Plus, Eye, EyeOff, Settings, Search, QrCode, ScanLine } from 'lucide-react';

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
  onScanToPayClick,
  onAddClick,
  onSettingsClick,
  searchQuery,
  onSearchChange,
  privacyMask,
  onTogglePrivacyMask,
  isSearchOpen,
  onToggleSearch,
  cardCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-fintech-dark/85 backdrop-blur-xl border-b border-slate-800/80 transition-all safe-top">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 safe-x">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand & Badges */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                  Pocket<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">QR</span>
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-950/60 text-red-300 border border-red-800/40">
                  🇵🇭 QR Ph
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Local-First • {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Controls with 44px minimum tap targets */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search Toggle */}
            <button
              onClick={onToggleSearch}
              aria-label="Search QR codes"
              className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                isSearchOpen
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline">Search</span>
            </button>

            {/* Privacy Number Masking Toggle */}
            <button
              onClick={onTogglePrivacyMask}
              aria-label={privacyMask ? 'Show full account numbers' : 'Mask account numbers'}
              title={privacyMask ? 'Account numbers masked (Click to reveal)' : 'Account numbers visible (Click to mask)'}
              className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                privacyMask
                  ? 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {privacyMask ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
              <span className="hidden lg:inline">{privacyMask ? 'Masked' : 'Revealed'}</span>
            </button>

            {/* Settings & Backup Modal */}
            <button
              onClick={onSettingsClick}
              aria-label="Settings and Backup"
              title="Vault Settings & Backups"
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Scan to Pay Button */}
            <button
              onClick={onScanToPayClick}
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
            >
              <ScanLine className="w-4 h-4 text-emerald-200" />
              <span>Scan to Pay</span>
            </button>

            {/* Add QR CTA */}
            <button
              onClick={onAddClick}
              className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm shadow-lg shadow-blue-950/30 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add QR</span>
            </button>
          </div>
        </div>

        {/* Expandable Search Input Bar */}
        {isSearchOpen && (
          <div className="mt-3 pt-2 border-t border-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search by account name, bank (GCash, Maya, RCBC...), or phone/account number..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[44px]"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
