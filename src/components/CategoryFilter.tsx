import React from 'react';
import type { QRCardItem } from '../types/qr';

export type FilterCategory =
  | 'all'
  | 'favorites'
  | 'personal'
  | 'business'
  | 'savings'
  | 'gcash'
  | 'maya'
  | 'rcbc'
  | 'banks';

interface CategoryFilterProps {
  currentFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  cards: QRCardItem[];
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  currentFilter,
  onFilterChange,
  cards,
}) => {
  const counts = React.useMemo(() => {
    return {
      all: cards.length,
      favorites: cards.filter((c) => c.isFavorite).length,
      personal: cards.filter((c) => c.category === 'personal').length,
      business: cards.filter((c) => c.category === 'business').length,
      savings: cards.filter((c) => c.category === 'savings').length,
      gcash: cards.filter((c) => c.bank === 'gcash').length,
      maya: cards.filter((c) => c.bank === 'maya').length,
      banks: cards.filter((c) =>
        ['bpi', 'unionbank', 'bdo', 'metrobank', 'cimb', 'seabank', 'gotyme'].includes(c.bank)
      ).length,
    };
  }, [cards]);

  const filterButtons: { id: FilterCategory; label: string; count: number }[] = [
    { id: 'all', label: 'ALL', count: counts.all },
    { id: 'favorites', label: 'FAVORITES', count: counts.favorites },
    { id: 'personal', label: 'PERSONAL', count: counts.personal },
    { id: 'business', label: 'BUSINESS', count: counts.business },
    { id: 'savings', label: 'SAVINGS', count: counts.savings },
    { id: 'gcash', label: 'GCASH', count: counts.gcash },
    { id: 'maya', label: 'MAYA', count: counts.maya },
    { id: 'banks', label: 'BANKS', count: counts.banks },
  ];

  return (
    <div className="flex flex-col gap-space-xs p-space-sm bg-surface-container-low rounded-lg shadow-sm border border-outline-variant/30 mb-space-md">
      {/* Top Hardware Telemetry Deck */}
      <div className="flex items-center justify-between font-label-sm text-label-sm">
        <div className="flex items-center gap-space-xs">
          <span className="inline-block w-2 h-2 rounded-none bg-primary-container shadow-[0_0_8px_rgba(0,240,160,0.8)] animate-pulse"></span>
          <span className="text-primary-fixed uppercase tracking-wider font-bold">BANK-EEPROM</span>
          <span className="text-outline">::</span>
          <span className="text-on-surface">SLOTS [{String(counts.all).padStart(2, '0')}/16]</span>
        </div>
        <div className="flex items-center gap-space-xs text-on-surface-variant">
          <span className="bg-surface-container-highest text-tertiary px-1 rounded-DEFAULT font-bold">
            SYNC:OK
          </span>
          <span className="text-secondary tracking-widest font-mono">384KB</span>
        </div>
      </div>

      {/* Filter Channel Selectors */}
      <div className="flex items-center gap-space-xs overflow-x-auto pt-1 pb-0.5 no-scrollbar">
        {filterButtons.map((btn) => {
          const isActive = currentFilter === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-2.5 py-1 font-label-sm text-label-sm rounded-DEFAULT shadow-[0_2px_0_0_#0b0e15] active:translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-bold ${
                isActive
                  ? 'bg-surface-container-highest text-primary-fixed border border-primary-fixed-dim/40'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {isActive && <span className="w-1.5 h-1.5 bg-primary-container"></span>}
              <span>{btn.label}</span>
              <span className={isActive ? 'text-primary-container' : 'text-outline'}>
                [{btn.count}]
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
