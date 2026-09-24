import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { ParsedEMVCo } from '../lib/emvcoParser';
import { formatAccountNumber } from '../lib/emvcoParser';
import type { PayingBankApp } from '../types/payment';
import { PAYING_BANK_APPS } from '../types/payment';
import {
  launchBankingApp,
  getDefaultPayingBank,
  setDefaultPayingBank,
} from '../lib/deepLink';
import {
  isNativeAndroid,
  getInstalledBankingApps,
} from '../lib/nativeBanking';
import { triggerHaptic } from '../lib/security';
import type { QRCardItem } from '../types/qr';

interface PaymentRoutingSheetProps {
  parsed: ParsedEMVCo;
  rawPayload: string;
  imageDataUrl?: string;
  onClose: () => void;
  onSaveToWallet: (card: QRCardItem) => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const PaymentRoutingSheet: React.FC<PaymentRoutingSheetProps> = ({
  parsed,
  rawPayload,
  imageDataUrl,
  onClose,
  onSaveToWallet,
  onNotify,
}) => {
  const [selectedApp, setSelectedApp] = useState<PayingBankApp>(() => {
    const savedDefaultId = getDefaultPayingBank();
    const found = PAYING_BANK_APPS.find((a) => a.id === savedDefaultId);
    return found || PAYING_BANK_APPS[0];
  });

  const [copiedNumber, setCopiedNumber] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [defaultBankId, setDefaultBankId] = useState<string | null>(() => getDefaultPayingBank());
  const [installedAppIds, setInstalledAppIds] = useState<string[]>([]);
  const [showAllApps, setShowAllApps] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  const isNative = isNativeAndroid();
  const recipientName = parsed.merchantName || 'VERIFIED QRPH PAYEE';
  const recipientNumber = parsed.accountNumber || '';
  const receivingBank = parsed.bankName || (parsed.isQRPh ? 'QR Ph Network' : 'Bank / E-Wallet');

  // Auto-copy account number to clipboard immediately when sheet mounts
  useEffect(() => {
    if (recipientNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(recipientNumber).then(() => {
        setCopiedNumber(true);
      }).catch(() => {});
    }
  }, [recipientNumber]);

  // Query installed apps on native Android
  useEffect(() => {
    if (isNative) {
      getInstalledBankingApps().then((installed) => {
        setInstalledAppIds(installed);
        if (installed.length > 0 && !installed.includes(selectedApp.id)) {
          const firstInstalled = PAYING_BANK_APPS.find((a) => installed.includes(a.id));
          if (firstInstalled) {
            setSelectedApp(firstInstalled);
          }
        }
      });
    }
  }, [isNative]);

  const displayedApps = React.useMemo(() => {
    if (isNative && !showAllApps && installedAppIds.length > 0) {
      return PAYING_BANK_APPS.filter((a) => installedAppIds.includes(a.id));
    }
    return PAYING_BANK_APPS;
  }, [isNative, showAllApps, installedAppIds]);

  const handleCopyNumber = () => {
    if (recipientNumber) {
      navigator.clipboard.writeText(recipientNumber);
      setCopiedNumber(true);
      triggerHaptic('success');
      onNotify('Copied to Clipboard!', recipientNumber, 'success');
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  const handleSaveToWallet = () => {
    if (hasSaved) return;

    const newCard: QRCardItem = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bank: parsed.detectedBank || 'other',
      bankCustomName: receivingBank,
      accountName: recipientName,
      accountNumber: recipientNumber,
      category: 'personal',
      rawPayload,
      imageDataUrl: imageDataUrl || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      orderIndex: 0,
      isFavorite: false,
    };

    onSaveToWallet(newCard);
    setHasSaved(true);
    triggerHaptic('success');
    try {
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.85 } });
    } catch {}
    onNotify('Saved to ROM Vault!', `${recipientName} is now in your wallet`, 'success');
  };

  const handleToggleDefault = () => {
    const isCurrentlyDefault = defaultBankId === selectedApp.id;
    const nextDefault = isCurrentlyDefault ? null : selectedApp.id;
    setDefaultPayingBank(nextDefault);
    setDefaultBankId(nextDefault);
    triggerHaptic('light');
    onNotify(
      nextDefault ? 'Default Cartridge Set' : 'Default Cleared',
      nextDefault ? `${selectedApp.name} will be prioritized` : 'You will be prompted each time',
      'info'
    );
  };

  const handleLaunchPayment = () => {
    setIsDispatching(true);
    triggerHaptic('light');

    // 1. Copy number
    if (recipientNumber) {
      navigator.clipboard.writeText(recipientNumber).catch(() => {});
    }

    // 2. Launch
    setTimeout(() => {
      launchBankingApp(selectedApp, recipientNumber);
      onNotify(
        `Launching ${selectedApp.name}...`,
        recipientNumber ? `Number copied: ${recipientNumber}` : undefined,
        'success'
      );
      setTimeout(() => setIsDispatching(false), 2000);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-surface/95 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto safe-p">
      <div className="relative w-full min-h-screen sm:min-h-0 sm:max-w-md bg-surface text-on-surface flex flex-col justify-between py-2 sm:py-4 px-margin sm:rounded-2xl sm:border sm:border-outline-variant/50 shadow-2xl">
        {/* Header */}
        <header className="sticky top-0 w-full z-10 pt-safe bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <button
                onClick={onClose}
                aria-label="Return"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface active:translate-y-0.5 transition-transform border border-outline-variant/40"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase truncate font-bold">
                Payment Dispatch
              </h1>
            </div>
            <button
              onClick={handleSaveToWallet}
              disabled={hasSaved}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-label-sm text-label-sm font-bold uppercase transition-all ${
                hasSaved
                  ? 'bg-primary-container/20 border-primary-fixed text-primary-fixed'
                  : 'bg-surface-container-high border-outline-variant/60 text-tertiary hover:bg-surface-bright active:translate-y-0.5'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {hasSaved ? 'bookmark_added' : 'bookmark_add'}
              </span>
              <span>{hasSaved ? 'SAVED' : 'SAVE ROM'}</span>
            </button>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <div className="flex flex-col w-full py-3 space-y-space-sm select-none">
          {/* Status HUD Tape */}
          <div className="flex items-center justify-between font-mono font-label-sm text-label-sm">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="text-primary tracking-wider uppercase font-bold">
                DECODER ACTIVE // QRPH 2.4
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded border border-outline-variant/30">
              <span className="text-on-surface-variant uppercase tracking-wider">ROUTING</span>
              <span className="text-primary-fixed font-bold">READY</span>
            </div>
          </div>

          {/* Transaction Summary Inset LCD Terminal */}
          <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-2xl relative overflow-hidden border border-outline-variant/40 font-mono">
            {/* Ambient dot-matrix raster overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#00f0a0_1px,transparent_1px)] [background-size:8px_8px]"></div>

            <div className="relative z-10 flex flex-col gap-space-sm">
              {/* Receipt Header */}
              <div className="flex items-center justify-between text-label-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    receipt_long
                  </span>
                  <span className="text-primary uppercase tracking-widest font-bold">
                    TRANSACTION RECEIPT
                  </span>
                </div>
                <span className="text-outline uppercase tracking-wider">QRPH // INSTAPAY</span>
              </div>

              {/* Merchant / Payee & Number Box */}
              <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm text-outline uppercase">VERIFIED RECIPIENT</span>
                  <span className="text-label-sm text-secondary font-bold tracking-wide">
                    {receivingBank}
                  </span>
                </div>
                <div className="font-headline-md text-headline-md text-on-surface tracking-tight truncate font-bold">
                  {recipientName}
                </div>

                {recipientNumber && (
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-outline-variant/30">
                    <span className="text-label-sm text-outline uppercase font-mono">
                      ACCT: {formatAccountNumber(recipientNumber, false)}
                    </span>
                    <button
                      onClick={handleCopyNumber}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-fixed font-bold font-mono bg-surface-container-high px-2 py-0.5 rounded cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {copiedNumber ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedNumber ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Amount if specified in QR */}
              {parsed.amount && (
                <div className="flex items-center justify-between bg-surface-container-high px-space-sm py-1 rounded-lg">
                  <span className="text-label-sm text-outline uppercase">PAYMENT AMOUNT:</span>
                  <span className="font-headline-md text-headline-md text-primary-fixed font-bold">
                    ₱{parsed.amount}
                  </span>
                </div>
              )}

              {/* Meta Telemetry */}
              <div className="grid grid-cols-2 gap-space-xs text-[10px]">
                <div className="bg-surface-container p-space-xs rounded flex flex-col">
                  <span className="text-outline uppercase">NETWORK PROTOCOL</span>
                  <span className="text-on-surface truncate font-bold">QRPH STANDARD P2M</span>
                </div>
                <div className="bg-surface-container p-space-xs rounded flex flex-col">
                  <span className="text-outline uppercase">SWITCHING FEE</span>
                  <span className="text-primary-fixed truncate font-bold">₱ 0.00 (FREE)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Notice: How Philippine Banks Process Deep Links */}
          <div className="bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/30 flex items-start gap-2 text-xs">
            <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
              info
            </span>
            <p className="text-on-surface-variant font-mono text-[11px] leading-relaxed">
              <strong className="text-on-surface">Auto-Copied:</strong> {recipientNumber} is in your clipboard. Once your banking app opens and you log in, tap{' '}
              <span className="text-primary-fixed font-bold">Send &gt; Express Send</span> and paste!
            </p>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between px-0.5 pt-1">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[16px]">
                swap_horiz
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight uppercase font-bold text-sm">
                CHOOSE PAYMENT CARTRIDGE
              </h2>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-label-sm">
              <span className="text-on-surface-variant font-bold">
                {displayedApps.length} APPS
              </span>
              {isNative && (
                <button
                  onClick={() => setShowAllApps(!showAllApps)}
                  className="text-primary hover:underline"
                >
                  {showAllApps ? '[INSTALLED ONLY]' : '[SHOW ALL]'}
                </button>
              )}
            </div>
          </div>

          {/* Cartridge Stack List */}
          <div className="flex flex-col gap-space-xs font-mono" role="radiogroup">
            {displayedApps.map((app) => {
              const isSelected = selectedApp.id === app.id;
              const isInstalled = isNative && installedAppIds.includes(app.id);

              return (
                <div
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    triggerHaptic('light');
                  }}
                  className={`cartridge-item cursor-pointer p-space-sm rounded-xl transition-all duration-150 active:translate-y-0.5 relative border ${
                    isSelected
                      ? 'bg-surface-container-high border-primary-fixed shadow-md'
                      : 'bg-surface-container border-outline-variant/30 hover:border-outline-variant/60'
                  }`}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-sm">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shadow-inner"
                        style={{ backgroundColor: app.accentColor + '20', color: app.accentColor }}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          account_balance_wallet
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-space-xs">
                          <span className="font-headline-md text-headline-md text-on-surface font-bold text-sm leading-none">
                            {app.name.toUpperCase()}
                          </span>
                          {isInstalled && (
                            <span className="bg-primary-container text-on-primary-container px-1 py-0.2 rounded font-label-sm text-[9px] uppercase font-bold">
                              INSTALLED
                            </span>
                          )}
                          {defaultBankId === app.id && (
                            <span className="bg-secondary text-on-secondary px-1 py-0.2 rounded font-label-sm text-[9px] uppercase font-bold">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <span className="font-label-sm text-[10px] text-tertiary-fixed font-bold tracking-wide mt-0.5">
                          {isInstalled ? 'FAST DISPATCH READY' : 'TAP TO LAUNCH'}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`cartridge-indicator w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container-high'
                      }`}
                    >
                      {isSelected ? (
                        <span className="material-symbols-outlined text-[16px] font-bold">
                          check
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-outline"></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Set as Default Preference Toggle */}
          <div className="flex items-center justify-between px-1 py-1 font-mono text-label-sm">
            <button
              onClick={handleToggleDefault}
              className="flex items-center gap-1.5 text-secondary hover:text-secondary-fixed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                {defaultBankId === selectedApp.id ? 'check_box' : 'check_box_outline_blank'}
              </span>
              <span>ALWAYS USE {selectedApp.name.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Action Deck (Thumb Zone) */}
        <div className="flex flex-col gap-space-xs pt-2 pb-safe border-t border-outline-variant/30">
          <button
            onClick={handleLaunchPayment}
            disabled={isDispatching}
            className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md font-bold py-3.5 px-space-md rounded-xl shadow-lg flex items-center justify-center gap-space-sm transition-all duration-100 active:translate-y-1 active:shadow-none uppercase cursor-pointer text-sm font-mono tracking-wider hover:bg-primary-fixed"
          >
            {isDispatching ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                <span>DISPATCHING INTENT...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">bolt</span>
                <span>LAUNCH {selectedApp.name.toUpperCase()} &amp; COMPLETE PAYMENT</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full bg-surface-container-high text-on-surface font-headline-md text-headline-md font-bold py-2.5 px-space-lg rounded-xl shadow-md transition-all duration-100 active:translate-y-0.5 uppercase tracking-wide flex items-center justify-center gap-space-xs text-xs font-mono"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>CANCEL TRANSACTION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
