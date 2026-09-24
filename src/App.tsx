import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllCards,
  saveCard,
  deleteCard,
  toggleFavorite,
  seedDefaultCardsIfEmpty,
  getSetting,
  setSetting,
} from './lib/storage';
import type { QRCardItem } from './types/qr';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import type { FilterCategory } from './components/CategoryFilter';
import { QRCard } from './components/QRCard';
import { PresentationModal } from './components/PresentationModal';
import { AddQRModal } from './components/AddQRModal';
import { ScanToPayModal } from './components/ScanToPayModal';
import { BackupSettingsModal } from './components/BackupSettingsModal';
import { InstallPrompt } from './components/InstallPrompt';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { Plus, QrCode, Lock, KeyRound, ScanLine } from 'lucide-react';
import { authenticateWithBiometrics, triggerHaptic } from './lib/security';

export function App() {
  const [cards, setCards] = useState<QRCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [privacyMask, setPrivacyMask] = useState(true);

  // Modals
  const [presentationCard, setPresentationCard] = useState<QRCardItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanToPayOpen, setIsScanToPayOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<QRCardItem | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Biometrics Lock State
  const [isVaultLocked, setIsVaultLocked] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (title: string, description?: string, type: 'success' | 'info' | 'error' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initial load: IndexedDB & Settings
  const loadCardsData = useCallback(async () => {
    try {
      await seedDefaultCardsIfEmpty();
      const loaded = await getAllCards();
      setCards(loaded);

      const savedMask = await getSetting('privacy_mask', true);
      setPrivacyMask(savedMask);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check if biometric lock is required
    const bioEnabled = localStorage.getItem('pocketqr_biometric_enabled') === 'true';
    if (bioEnabled) {
      setIsVaultLocked(true);
    }
    loadCardsData();
  }, [loadCardsData]);

  // Global paste handler to open Add modal on Ctrl+V anywhere
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if an input is focused or a modal is already open
      const activeEl = document.activeElement;
      const isInput =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (!isInput && !isAddModalOpen && !presentationCard && !isScanToPayOpen) {
        if (e.clipboardData && e.clipboardData.files.length > 0) {
          const file = e.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            setEditingCard(null);
            setIsAddModalOpen(true);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isAddModalOpen, presentationCard, isScanToPayOpen]);

  const handleUnlockVault = async () => {
    const verified = await authenticateWithBiometrics();
    if (verified) {
      setIsVaultLocked(false);
      triggerHaptic('success');
      addToast('Vault Unlocked', 'Welcome back!', 'success');
    } else {
      triggerHaptic('error');
      addToast('Authentication Failed', 'Please try again', 'error');
    }
  };

  const handleTogglePrivacyMask = async () => {
    const nextVal = !privacyMask;
    setPrivacyMask(nextVal);
    await setSetting('privacy_mask', nextVal);
    triggerHaptic('light');
  };

  const handleSaveCard = async (card: QRCardItem) => {
    await saveCard(card);
    await loadCardsData();
    triggerHaptic('success');
    addToast(
      editingCard ? 'Card Updated!' : 'Card Added to Wallet!',
      `${card.accountName} (${card.bank.toUpperCase()})`,
      'success'
    );
    setEditingCard(null);
  };

  const handleDeleteCard = async (id: string) => {
    const cardToDelete = cards.find((c) => c.id === id);
    await deleteCard(id);
    await loadCardsData();
    triggerHaptic('warning');
    addToast(
      'Card Deleted',
      cardToDelete ? `${cardToDelete.accountName} removed` : undefined,
      'info'
    );
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await loadCardsData();
  };

  // Filter & Search logic
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // 1. Category Tab Filter
      if (currentFilter === 'favorites' && !card.isFavorite) return false;
      if (currentFilter === 'gcash' && card.bank !== 'gcash') return false;
      if (currentFilter === 'maya' && card.bank !== 'maya') return false;
      if (currentFilter === 'rcbc' && card.bank !== 'rcbc') return false;
      if (
        currentFilter === 'banks' &&
        !['bpi', 'unionbank', 'bdo', 'metrobank', 'cimb', 'seabank', 'gotyme'].includes(card.bank)
      ) {
        return false;
      }
      if (currentFilter === 'personal' && card.category !== 'personal') return false;
      if (currentFilter === 'business' && card.category !== 'business') return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = card.accountName.toLowerCase().includes(q);
        const matchesNumber = card.accountNumber.includes(q);
        const matchesBank =
          card.bank.toLowerCase().includes(q) ||
          (card.bankCustomName && card.bankCustomName.toLowerCase().includes(q));
        const matchesNotes = card.notes ? card.notes.toLowerCase().includes(q) : false;
        const matchesCategory = card.category.toLowerCase().includes(q);

        if (!matchesName && !matchesNumber && !matchesBank && !matchesNotes && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [cards, currentFilter, searchQuery]);

  // Biometric Locked Screen View
  if (isVaultLocked) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-fintech-dark flex items-center justify-center p-4 safe-p">
        <div className="max-w-sm w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">PocketQR Locked</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Biometric authentication is required to access your stored payment QR Ph cards.
          </p>

          <button
            onClick={handleUnlockVault}
            className="min-h-[44px] mt-6 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            <span>Unlock Vault</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-fintech-dark text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Header */}
      <Header
        onScanToPayClick={() => setIsScanToPayOpen(true)}
        onAddClick={() => {
          setEditingCard(null);
          setIsAddModalOpen(true);
        }}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        privacyMask={privacyMask}
        onTogglePrivacyMask={handleTogglePrivacyMask}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        cardCount={cards.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12 flex flex-col safe-x">
        {/* Category Pills Filter */}
        <CategoryFilter
          currentFilter={currentFilter}
          onFilterChange={setCurrentFilter}
          cards={cards}
        />

        {/* Card Stack / Wallet Adaptive Grid (1 col on mobile, 2 cols on tablet, 3 cols on landscape desktop) */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-500 text-sm">
            Loading your local QR Ph vault...
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-4">
            {filteredCards.map((card) => (
              <QRCard
                key={card.id}
                card={card}
                privacyMask={privacyMask}
                onPresent={(c) => setPresentationCard(c)}
                onEdit={(c) => {
                  setEditingCard(c);
                  setIsAddModalOpen(true);
                }}
                onDelete={handleDeleteCard}
                onToggleFavorite={handleToggleFavorite}
                onNotify={addToast}
              />
            ))}
          </div>
        ) : (
          /* Empty Search / Category State */
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
              <QrCode className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-white">No QR Ph Cards Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5 leading-relaxed">
              {searchQuery
                ? `No cards matching "${searchQuery}". Try searching for another name or bank.`
                : 'No cards in this category yet. Add your GCash, Maya, or bank QR Ph screenshot.'}
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsScanToPayOpen(true)}
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm shadow-lg active:scale-95 transition-all"
              >
                <ScanLine className="w-4 h-4" />
                <span>Scan to Pay Someone</span>
              </button>

              <button
                onClick={() => {
                  setEditingCard(null);
                  setIsAddModalOpen(true);
                }}
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Presentation Fullscreen Modal (Cashier Mode) */}
      <PresentationModal
        card={presentationCard}
        onClose={() => setPresentationCard(null)}
        onNotify={addToast}
      />

      {/* Scan to Pay Live Camera Scanner */}
      <ScanToPayModal
        isOpen={isScanToPayOpen}
        onClose={() => setIsScanToPayOpen(false)}
        onSaveToWallet={handleSaveCard}
        onNotify={addToast}
      />

      {/* Add / Edit QR Modal */}
      <AddQRModal
        isOpen={isAddModalOpen}
        initialCard={editingCard}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        onNotify={addToast}
      />

      {/* Settings & Backup Modal */}
      <BackupSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        cardCount={cards.length}
        privacyMask={privacyMask}
        onTogglePrivacyMask={handleTogglePrivacyMask}
        onReloadCards={loadCardsData}
        onNotify={addToast}
      />

      {/* Install PWA Prompt Banner */}
      <InstallPrompt />

      {/* Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
