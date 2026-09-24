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
import { ConfigView } from './components/ConfigView';
import { InstallPrompt } from './components/InstallPrompt';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { authenticateWithBiometrics, triggerHaptic } from './lib/security';
import { BottomNav } from './components/BottomNav';
import type { NavTab } from './components/BottomNav';

export function App() {
  const [cards, setCards] = useState<QRCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [privacyMask, setPrivacyMask] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('vault');

  // Modals
  const [presentationCard, setPresentationCard] = useState<QRCardItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScanToPayOpen, setIsScanToPayOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<QRCardItem | null>(null);

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
      <div className="min-h-screen min-h-[100dvh] bg-surface text-on-surface flex items-center justify-center p-margin font-mono safe-p">
        <div className="max-w-sm w-full p-space-lg rounded-2xl bg-surface-container border border-outline-variant/50 shadow-2xl text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-xl bg-surface-container-high border border-primary-fixed-dim/40 flex items-center justify-center text-primary-fixed mb-space-sm shadow-[0_0_16px_rgba(0,240,160,0.3)]">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>

          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            SECURITY INTERLOCK ENGAGED
          </span>
          <h2 className="font-headline-md text-headline-md font-bold text-primary-fixed uppercase tracking-tight mt-1">
            POCKET•QR LOCKED
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 font-sans leading-relaxed">
            Biometric authentication is required to access your stored payment ROM cartridges.
          </p>

          <button
            onClick={handleUnlockVault}
            className="mt-6 w-full py-3 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-primary font-headline-md font-bold text-sm shadow-[0_4px_0_0_#006843] active:translate-y-1 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[20px]">fingerprint</span>
            <span>AUTHENTICATE &amp; UNLOCK</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-surface text-on-surface flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        onScanToPayClick={() => setIsScanToPayOpen(true)}
        onAddClick={() => {
          setEditingCard(null);
          setIsAddModalOpen(true);
        }}
        onSettingsClick={() => setCurrentTab(currentTab === 'config' ? 'vault' : 'config')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        privacyMask={privacyMask}
        onTogglePrivacyMask={handleTogglePrivacyMask}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        cardCount={cards.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto px-margin pt-3 pb-32 flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
        {currentTab === 'vault' && (
          <>
            {/* Category Pills Filter */}
            <CategoryFilter
              currentFilter={currentFilter}
              onFilterChange={setCurrentFilter}
              cards={cards}
            />

            {/* Cartridge Stack Deck */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center py-20 text-outline text-xs font-mono">
                [ LOADING BANK-EEPROM VAULT... ]
              </div>
            ) : filteredCards.length > 0 ? (
              <div className="flex flex-col gap-space-sm">
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
              <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center font-mono">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary-fixed mb-4 shadow-inner">
                  <span className="material-symbols-outlined text-[28px]">qr_code_2</span>
                </div>

                <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                  NO CARTRIDGES FOUND
                </h3>
                <p className="text-xs text-outline max-w-xs mt-1 mb-5 font-sans leading-relaxed">
                  {searchQuery
                    ? `No ROM matching "${searchQuery}". Try searching for another name or bank.`
                    : 'No cartridges in this bank channel yet. Add your GCash, Maya, or bank QR.'}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsScanToPayOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shadow-lg active:translate-y-0.5 transition-all uppercase hover:bg-primary-fixed cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                    <span>SCAN TO PAY</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingCard(null);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold border border-outline-variant/40 active:translate-y-0.5 transition-all uppercase hover:bg-surface-bright cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>ADD ROM</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {currentTab === 'logs' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center font-mono space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold uppercase">
              TRANSACTION LOGS // ARCHIVE
            </h3>
            <p className="text-xs text-outline max-w-xs font-sans leading-relaxed">
              When you scan and dispatch QR Ph payments, transaction receipts are verified and stored locally on your device with offline cryptographic privacy.
            </p>
            <div className="pt-2">
              <span className="font-label-sm text-label-sm text-primary-fixed bg-surface-container-high px-2 py-1 rounded border border-primary-fixed/30">
                AUDIT SIGNATURE: SHA-256 SECURED
              </span>
            </div>
          </div>
        )}

        {currentTab === 'rails' && (
          <div className="flex flex-col gap-space-sm font-mono mt-1">
            <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs text-primary-fixed font-bold">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>QR PH NATIONAL RAILS</span>
                </div>
                <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-1.5 py-0.5 rounded">
                  BSP 1055
                </span>
              </div>
              <p className="text-xs text-outline mt-2 font-sans leading-relaxed">
                The Bangko Sentral ng Pilipinas (BSP) National Retail Payment System enables cross-app interoperability between e-wallets and commercial banks across the Philippines.
              </p>
            </div>

            <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/40 space-y-2">
              <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                COMPLIANT INSTITUTIONS (INSTAPAY READY)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="font-bold text-on-surface">GCash (Globe)</span>
                </div>
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-on-surface">Maya (PayMaya)</span>
                </div>
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  <span className="font-bold text-on-surface">BPI Online</span>
                </div>
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <span className="font-bold text-on-surface">GoTyme Bank</span>
                </div>
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                  <span className="font-bold text-on-surface">RCBC Pulz</span>
                </div>
                <div className="p-2 bg-surface-container rounded border border-outline-variant/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="font-bold text-on-surface">UnionBank</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'config' && (
          <ConfigView
            cardCount={cards.length}
            privacyMask={privacyMask}
            onTogglePrivacyMask={handleTogglePrivacyMask}
            onReloadCards={loadCardsData}
            onNotify={addToast}
          />
        )}
      </main>

      {/* Tactile Cyberdeck Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onScanClick={() => setIsScanToPayOpen(true)}
        onConfigClick={() => setCurrentTab('config')}
      />

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
        cardCount={cards.length}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
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
