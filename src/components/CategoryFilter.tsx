import React from 'react';
import type { QRCardItem } from '../types/qr';

export type FilterCategory =
  | 'all'
  | 'favorites'
  | 'gcash'
  | 'maya'
  | 'rcbc'
  | 'banks'
  | 'personal'
  | 'business';

interface CategoryFilterProps {
  currentFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  cards: QRCardItem[];
}

interface FilterTab {
  id: FilterCategory;
  label: string;
  getCount: (cards: QRCardItem[]) => number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  currentFilter,
  onFilterChange,
  cards,
}) => {
  const tabs: FilterTab[] = [
    {
      id: 'all',
      label: 'All Cards',
      getCount: (c) => c.length,
    },
    {
      id: 'favorites',
      label: '⭐ Starred',
      getCount: (c) => c.filter((x) => x.isFavorite).length,
    },
    {
      id: 'gcash',
      label: 'GCash',
      getCount: (c) => c.filter((x) => x.bank === 'gcash').length,
    },
    {
      id: 'maya',
      label: 'Maya',
      getCount: (c) => c.filter((x) => x.bank === 'maya').length,
    },
    {
      id: 'rcbc',
      label: 'RCBC / Pulz',
      getCount: (c) => c.filter((x) => x.bank === 'rcbc').length,
    },
    {
      id: 'banks',
      label: 'Traditional Banks',
      getCount: (c) =>
        c.filter((x) =>
          ['bpi', 'unionbank', 'bdo', 'metrobank', 'cimb', 'seabank', 'gotyme'].includes(x.bank)
        ).length,
    },
    {
      id: 'personal',
      label: 'Personal',
      getCount: (c) => c.filter((x) => x.category === 'personal').length,
    },
    {
      id: 'business',
      label: 'Business',
      getCount: (c) => c.filter((x) => x.category === 'business').length,
    },
  ];

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 touch-scroll">
      <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max px-4 sm:px-6 lg:px-8 safe-x">
        {tabs.map((tab) => {
          const count = tab.getCount(cards);
          const isActive = currentFilter === tab.id;

          // Don't hide 0 counts if it's 'all' or 'favorites', but hide empty specific banks
          if (count === 0 && tab.id !== 'all' && tab.id !== 'favorites') {
            return null;
          }

          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 border cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-slate-100 text-slate-900 border-white shadow-md shadow-white/10 font-semibold'
                  : 'bg-slate-900/70 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-slate-900 text-white font-mono'
                    : 'bg-slate-800 text-slate-400 font-mono'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
