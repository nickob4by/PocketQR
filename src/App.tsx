import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllCards,
  saveCard,
  deleteCard,
  toggleFavorite,
  seedDefaultCardsIfEmpty,
  getSetting,
  setSetting,
  getAllLogs,
  deleteLog,
  clearAllLogs,
  addLog,
} from './lib/storage';
import type { QRCardItem, ActivityLogItem } from './types/qr';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import type { FilterCategory } from './components/CategoryFilter';
import { QRCard } from './components/QRCard';
import { PresentationModal } from './components/PresentationModal';
import { PaymentRoutingSheet } from './components/PaymentRoutingSheet';
import { parseQRPhPayload } from './lib/emvcoParser';
import { AddQRModal } from './components/AddQRModal';
import { ScanToPayModal } from './components/ScanToPayModal';
import { LogsView } from './components/LogsView';
import { ConfigView } from './components/ConfigView';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { authenticateWithBiometrics, triggerHaptic } from './lib/security';
import { BottomNav } from './components/BottomNav';
import type { NavTab } from './components/BottomNav';

export function App() {
  const [cards, setCards] = useState<QRCardItem[]>([]);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyMask, setPrivacyMask] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('vault');

  // Modals
  const [presentationCard, setPresentationCard] = useState<QRCardItem | null>(null);
  const [routingCard, setRoutingCard] = useState<QRCardItem | null>(null);
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

  const loadLogsData = useCallback(async () => {
    try {
      const loadedLogs = await getAllLogs();
      setLogs(loadedLogs);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, []);

  // Initial load: IndexedDB & Settings
  const loadCardsData = useCallback(async () => {
    try {
      await seedDefaultCardsIfEmpty();
      const loaded = await getAllCards();

      // Automatically repair any cards that had stale system routing codes saved
      const repairedCards = await Promise.all(
        loaded.map(async (card) => {
          const isStaleRouting =
            card.accountNumber === '99964403' ||
            card.accountNumber === '217020000000656' ||
            card.accountNumber?.startsWith('217020000000');

          if (card.rawPayload && (isStaleRouting || !card.city || !card.rail)) {
            const parsed = parseQRPhPayload(card.rawPayload);
            if (parsed.isValid && parsed.isQRPh) {
              const updatedCard: QRCardItem = {
                ...card,
                accountNumber: isStaleRouting ? (parsed.accountNumber || card.accountNumber) : card.accountNumber,
                city: card.city || parsed.city,
                rail: card.rail || parsed.rail,
              };
              await saveCard(updatedCard);
              return updatedCard;
            }
          }
          return card;
        })
      );

      setCards(repairedCards);

      const savedMask = await getSetting('privacy_mask', true);
      setPrivacyMask(savedMask);

      await loadLogsData();
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  }, [loadLogsData]);

  useEffect(() => {
    // Check if biometric lock is required
    const bioEnabled = localStorage.getItem('pocketqr_biometric_enabled') === 'true';
    if (bioEnabled) {
      setIsVaultLocked(true);
    }
    const savedTone = localStorage.getItem('pocketqr_theme_tone') || 'MINT';
    document.documentElement.setAttribute('data-colorway', savedTone);
    if (localStorage.getItem('pocketqr_crt_scanlines') === 'true') {
      document.body.classList.add('crt-scanlines');
    }
    if (localStorage.getItem('pocketqr_oled_black') === 'true') {
      document.documentElement.classList.add('oled-deep-black');
    }
    loadCardsData();
  }, [loadCardsData]);

  useEffect(() => {
    if (currentTab === 'logs') {
      loadLogsData();
    }
  }, [currentTab, loadLogsData]);

  // Modal History Stack Manager (Supports Android hardware / system Back button)
  const openModal = useCallback((type: string) => {
    window.history.pushState({ pocketqrModal: type }, '');
  }, []);

  const closeModal = useCallback(() => {
    if (window.history.state?.pocketqrModal) {
      window.history.back();
    } else {
      setPresentationCard(null);
      setRoutingCard(null);
      setIsAddModalOpen(false);
      setIsScanToPayOpen(false);
      setEditingCard(null);
    }
  }, []);

  const handleOpenPresentation = useCallback((card: QRCardItem) => {
    openModal('presentation');
    setPresentationCard(card);
  }, [openModal]);

  const handleOpenAdd = useCallback((cardToEdit: QRCardItem | null = null) => {
    openModal('add');
    setEditingCard(cardToEdit);
    setIsAddModalOpen(true);
  }, [openModal]);

  const handleOpenScan = useCallback(() => {
    openModal('scan');
    setIsScanToPayOpen(true);
  }, [openModal]);

  useEffect(() => {
    const handlePopState = () => {
      setPresentationCard(null);
      setRoutingCard(null);
      setIsAddModalOpen(false);
      setIsScanToPayOpen(false);
      setEditingCard(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
            handleOpenAdd(null);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isAddModalOpen, presentationCard, isScanToPayOpen, handleOpenAdd]);

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
    const isEdit = Boolean(editingCard);
    await saveCard(card);
    await loadCardsData();
    await addLog({
      type: isEdit ? 'card_updated' : 'card_added',
      title: card.accountName,
      bank: (card.bankCustomName || card.bank).toUpperCase(),
      accountNumber: card.accountNumber,
      rawPayload: card.rawPayload,
      detail: isEdit ? 'Updated card details in vault' : 'Added new card to vault',
    });
    await loadLogsData();
    triggerHaptic('success');
    addToast(
      isEdit ? 'Card Updated!' : 'Card Added to Wallet!',
      `${card.accountName} (${card.bank.toUpperCase()})`,
      'success'
    );
    setEditingCard(null);
  };

  const handleDeleteCard = async (id: string) => {
    const cardToDelete = cards.find((c) => c.id === id);
    await deleteCard(id);
    await loadCardsData();
    if (cardToDelete) {
      await addLog({
        type: 'card_deleted',
        title: cardToDelete.accountName,
        bank: (cardToDelete.bankCustomName || cardToDelete.bank).toUpperCase(),
        accountNumber: cardToDelete.accountNumber,
        detail: 'Removed card from vault',
      });
      await loadLogsData();
    }
    triggerHaptic('warning');
    addToast(
      'Card Deleted',
      cardToDelete ? `${cardToDelete.accountName} removed` : undefined,
      'info'
    );
  };

  const handleDeleteLog = async (id: string) => {
    await deleteLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    triggerHaptic('light');
  };

  const handleClearAllLogs = async () => {
    await clearAllLogs();
    setLogs([]);
    triggerHaptic('warning');
    addToast('Logs Cleared', 'All activity entries wiped', 'info');
  };

  const handleRePayFromLog = (rawPayload: string) => {
    const parsed = parseQRPhPayload(rawPayload);
    setRoutingCard({
      id: `repay_${Date.now()}`,
      bank: (parsed.detectedBank as any) || 'other',
      bankCustomName: parsed.bankName,
      accountName: parsed.merchantName || 'VERIFIED QRPH PAYEE',
      accountNumber: parsed.accountNumber || '',
      category: 'personal',
      rawPayload,
      imageDataUrl: '',
      isFavorite: false,
      orderIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    openModal('routing');
  };

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await loadCardsData();
  };

  // Filter & Search logic
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // 1. Bank Channel Filter
      if (currentFilter !== 'all') {
        if (currentFilter === 'other') {
          if (['gcash', 'maya', 'bpi', 'unionbank', 'bdo', 'gotyme', 'rcbc', 'seabank'].includes(card.bank)) {
            return false;
          }
        } else if (card.bank !== currentFilter) {
          return false;
        }
      }

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
        cardCount={cards.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto px-margin pt-3 pb-32 flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
        {currentTab === 'vault' && (
          <>
            {/* Search Bar & Category Filter Deck */}
            <CategoryFilter
              currentFilter={currentFilter}
              onFilterChange={setCurrentFilter}
              cards={cards}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
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
                    onPresent={handleOpenPresentation}
                    onEdit={handleOpenAdd}
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
                    onClick={handleOpenScan}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shadow-lg active:translate-y-0.5 transition-all uppercase hover:bg-primary-fixed cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                    <span>SCAN TO PAY</span>
                  </button>

                  <button
                    onClick={() => handleOpenAdd(null)}
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
          <LogsView
            logs={logs}
            onDeleteLog={handleDeleteLog}
            onClearAllLogs={handleClearAllLogs}
            onRePay={handleRePayFromLog}
          />
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
        onScanClick={handleOpenScan}
        onConfigClick={() => setCurrentTab('config')}
      />

      {/* Presentation Fullscreen Modal (Cashier Mode) */}
      <PresentationModal
        card={presentationCard}
        onClose={closeModal}
        onPayWithBank={(c) => {
          window.history.replaceState({ pocketqrModal: 'routing' }, '');
          setPresentationCard(null);
          setRoutingCard(c);
        }}
        onNotify={addToast}
        onLogAdded={loadLogsData}
      />

      {/* Payment Routing Sheet from Vault Card */}
      {routingCard && (
        <PaymentRoutingSheet
          parsed={
            routingCard.rawPayload
              ? parseQRPhPayload(routingCard.rawPayload)
              : {
                  isValid: true,
                  isQRPh: false,
                  merchantName: routingCard.accountName,
                  accountNumber: routingCard.accountNumber,
                  bankName: routingCard.bankCustomName || routingCard.bank,
                  detectedBank: routingCard.bank,
                  tags: {},
                }
          }
          rawPayload={routingCard.rawPayload || ''}
          imageDataUrl={routingCard.imageDataUrl}
          existingCards={cards}
          onClose={closeModal}
          onSaveToWallet={handleSaveCard}
          onNotify={addToast}
          onLogAdded={loadLogsData}
        />
      )}

      {/* Scan to Pay Live Camera Scanner */}
      <ScanToPayModal
        isOpen={isScanToPayOpen}
        existingCards={cards}
        onClose={closeModal}
        onSaveToWallet={handleSaveCard}
        onNotify={addToast}
        onLogAdded={loadLogsData}
      />

      {/* Add / Edit QR Modal */}
      <AddQRModal
        isOpen={isAddModalOpen}
        initialCard={editingCard}
        existingCards={cards}
        cardCount={cards.length}
        onClose={closeModal}
        onSave={handleSaveCard}
        onNotify={addToast}
        onViewExisting={(dup) => {
          closeModal();
          handleOpenPresentation(dup);
        }}
      />

      {/* Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
