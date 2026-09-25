import React from 'react';
import type { QRCardItem } from '../types/qr';

export type FilterCategory =
  | 'all'
  | 'gcash'
  | 'maya'
  | 'bpi'
  | 'unionbank'
  | 'bdo'
  | 'gotyme'
  | 'rcbc'
  | 'seabank'
  | 'other';

interface CategoryFilterProps {
  currentFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  cards: QRCardItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  currentFilter,
  onFilterChange,
  cards,
  searchQuery,
  onSearchChange,
}) => {
  const counts = React.useMemo(() => {
    return {
      all: cards.length,
      gcash: cards.filter((c) => c.bank === 'gcash').length,
      maya: cards.filter((c) => c.bank === 'maya').length,
      bpi: cards.filter((c) => c.bank === 'bpi').length,
      unionbank: cards.filter((c) => c.bank === 'unionbank').length,
      bdo: cards.filter((c) => c.bank === 'bdo').length,
      gotyme: cards.filter((c) => c.bank === 'gotyme').length,
      rcbc: cards.filter((c) => c.bank === 'rcbc').length,
      seabank: cards.filter((c) => c.bank === 'seabank').length,
      other: cards.filter((c) =>
        ['other', 'metrobank', 'cimb'].includes(c.bank)
      ).length,
    };
  }, [cards]);

  const filterButtons = React.useMemo(() => {
    const allButtons: { id: FilterCategory; label: string; count: number }[] = [
      { id: 'all', label: 'ALL', count: counts.all },
      { id: 'gcash', label: 'GCASH', count: counts.gcash },
      { id: 'maya', label: 'MAYA', count: counts.maya },
      { id: 'bpi', label: 'BPI', count: counts.bpi },
      { id: 'unionbank', label: 'UNIONBANK', count: counts.unionbank },
      { id: 'bdo', label: 'BDO', count: counts.bdo },
      { id: 'gotyme', label: 'GOTYME', count: counts.gotyme },
      { id: 'rcbc', label: 'RCBC', count: counts.rcbc },
      { id: 'seabank', label: 'SEABANK', count: counts.seabank },
      { id: 'other', label: 'OTHER', count: counts.other },
    ];

    // Only show banks that actually have cards in the vault
    return allButtons.filter((btn) => btn.id === 'all' || btn.count > 0);
  }, [counts]);

  // If current filter has 0 cards, reset to 'all'
  React.useEffect(() => {
    const exists = filterButtons.some((b) => b.id === currentFilter);
    if (!exists && currentFilter !== 'all') {
      onFilterChange('all');
    }
  }, [filterButtons, currentFilter, onFilterChange]);

  return (
    <div className="flex flex-col gap-2 p-2.5 bg-surface-container-low rounded-xl shadow-sm border border-white/[0.06] mb-3">
      {/* Permanent Search Bar replacing "BANK CHANNEL FILTER" */}
      <div className="relative w-full">
        <span className="material-symbols-outlined text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-outline">
          search
        </span>
        <input
          type="text"
          placeholder="Search payee or bank..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-surface-container-lowest border border-white/[0.08] rounded-lg pl-9 pr-8 py-2 text-xs font-label-md text-on-surface placeholder-outline focus:outline-none focus:border-primary-fixed transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[14px] text-outline hover:text-on-surface p-0.5 flex items-center cursor-pointer"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Horizontally Scrollable Bank Channel Selectors */}
      <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x flex-nowrap shrink-0 no-scrollbar scroll-smooth">
        {filterButtons.map((btn) => {
          const isActive = currentFilter === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-3 py-1.5 font-label-sm text-label-sm rounded-lg shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-bold text-xs cursor-pointer ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-mono shadow-[0_2px_0_0_#006843]'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-white/[0.06]'
              }`}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container"></span>}
              <span>{btn.label}</span>
              <span className={`text-[10px] ${isActive ? 'text-on-primary-container/80' : 'text-outline'}`}>
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
