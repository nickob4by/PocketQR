import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
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
import {
  saveQRToGallery,
  copyQRImageToClipboard,
} from '../lib/qrImageUtils';
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

  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedQR, setCopiedQR] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [isSavingQR, setIsSavingQR] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [defaultBankId, setDefaultBankId] = useState<string | null>(() => getDefaultPayingBank());
  const [installedAppIds, setInstalledAppIds] = useState<string[]>([]);
  const [showAllApps, setShowAllApps] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  const isNative = isNativeAndroid();
  const recipientName = parsed.merchantName || 'VERIFIED QRPH PAYEE';
  const recipientNumber = parsed.accountNumber || '';
  const receivingBank = parsed.bankName || (parsed.isQRPh ? 'QR Ph Network' : 'Bank / E-Wallet');

  // Auto-copy QR image and account number to clipboard immediately when sheet mounts
  useEffect(() => {
    copyQRImageToClipboard({
      rawPayload,
      imageDataUrl,
      textFallback: recipientNumber,
    }).then((res) => {
      if (res.success) {
        setCopiedQR(true);
        setTimeout(() => setCopiedQR(false), 2000);
      }
    });
  }, [rawPayload, imageDataUrl, recipientNumber]);

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

  const handleSaveQR = async () => {
    setIsSavingQR(true);
    triggerHaptic('light');
    const res = await saveQRToGallery({
      rawPayload,
      imageDataUrl,
      accountName: recipientName,
    });
    setIsSavingQR(false);

    if (res.success) {
      setSavedToGallery(true);
      triggerHaptic('success');
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } catch {}
      onNotify('QR Saved to Recent Photos!', 'Open GCash/Bank and tap "Upload QR"', 'success');
    } else {
      onNotify('Save Failed', res.message, 'error');
    }
  };

  const handleCopyQR = async () => {
    triggerHaptic('light');
    const res = await copyQRImageToClipboard({
      rawPayload,
      imageDataUrl,
      textFallback: recipientNumber,
    });

    if (res.success) {
      setCopiedQR(true);
      triggerHaptic('success');
      onNotify('QR Image Copied!', 'Image is ready in your clipboard to paste or upload', 'success');
      setTimeout(() => setCopiedQR(false), 2500);
    } else {
      onNotify('Copy Failed', res.message, 'error');
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

  const handleLaunchPayment = async () => {
    setIsDispatching(true);
    triggerHaptic('light');

    // 1. Auto-save QR image to Gallery/Recent Photos so it is immediately #1 in bank photo picker
    try {
      await saveQRToGallery({
        rawPayload,
        imageDataUrl,
        accountName: recipientName,
      });
      setSavedToGallery(true);
    } catch (e) {
      console.warn('Auto save gallery failed:', e);
    }

    // 2. Ensure QR image & account number are in clipboard
    try {
      await copyQRImageToClipboard({
        rawPayload,
        imageDataUrl,
        textFallback: recipientNumber,
      });
    } catch (e) {
      console.warn('Auto copy clipboard failed:', e);
    }

    // 3. Launch native banking app
    setTimeout(() => {
      launchBankingApp(selectedApp, recipientNumber);
      onNotify(
        `Launching ${selectedApp.name}...`,
        'QR image saved to Recent Photos! Tap "Upload QR" in app to pay.',
        'success'
      );
      setTimeout(() => setIsDispatching(false), 2000);
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface sm:bg-surface-container-lowest/80 sm:backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-surface text-on-surface flex flex-col sm:rounded-2xl sm:border sm:border-outline-variant/50 shadow-2xl overflow-hidden">
        {/* Header - Fixed Flex Sibling */}
        <header className="flex-shrink-0 w-full z-30 pt-safe bg-surface border-b border-outline-variant/30 px-margin py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <button
                onClick={onClose}
                aria-label="Return"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-on-surface active:translate-y-0.5 transition-transform border border-outline-variant/40"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase truncate font-bold text-sm sm:text-base">
                Payment Dispatch
              </h1>
            </div>
            <button
              onClick={handleSaveToWallet}
              disabled={hasSaved}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-label-sm text-label-sm font-bold uppercase transition-all ${
                hasSaved
                  ? 'bg-primary-container/20 border-primary-fixed text-primary-fixed'
                  : 'bg-surface-container-high border-outline-variant/60 text-tertiary hover:bg-surface-bright active:translate-y-0.5 cursor-pointer'
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
        <div className="flex-1 overflow-y-auto px-margin py-3 space-y-space-sm select-none">
          {/* Status HUD Tape */}
          <div className="flex items-center justify-between font-mono font-label-sm text-label-sm">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="text-primary tracking-wider uppercase font-bold text-[11px]">
                DECODER ACTIVE // QRPH 2.4
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded border border-outline-variant/30 text-[10px]">
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
                  <span className="text-primary uppercase tracking-widest font-bold text-[11px]">
                    TRANSACTION RECEIPT
                  </span>
                </div>
                <span className="text-outline uppercase tracking-wider text-[10px]">
                  QRPH // INSTAPAY
                </span>
              </div>

              {/* Merchant / Payee & QR Preview Box */}
              <div className="bg-surface-container-low p-space-sm rounded-lg flex items-center gap-3 border border-outline-variant/30">
                {/* QR Code Mini-Preview */}
                <div className="w-14 h-14 bg-white p-1 rounded-md flex-shrink-0 flex items-center justify-center shadow-inner">
                  {rawPayload ? (
                    <QRCodeSVG value={rawPayload} size={48} level="M" />
                  ) : imageDataUrl ? (
                    <img src={imageDataUrl} alt="QR" className="w-full h-full object-contain" />
                  ) : (
                    <span className="material-symbols-outlined text-black text-[24px]">qr_code_2</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-outline uppercase font-mono">VERIFIED RECIPIENT</span>
                    <span className="text-[10px] text-secondary font-bold tracking-wide truncate max-w-[120px]">
                      {receivingBank}
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface tracking-tight truncate font-bold text-sm">
                    {recipientName}
                  </div>

                  {recipientNumber && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-outline font-mono">
                        {formatAccountNumber(recipientNumber, false)}
                      </span>
                      <button
                        onClick={handleCopyNumber}
                        className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary-fixed font-bold font-mono bg-surface-container-high px-1.5 py-0.2 rounded cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[11px]">
                          {copiedNumber ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedNumber ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount if specified in QR */}
              {parsed.amount && (
                <div className="flex items-center justify-between bg-surface-container-high px-space-sm py-1 rounded-lg">
                  <span className="text-label-sm text-outline uppercase text-[11px]">PAYMENT AMOUNT:</span>
                  <span className="font-headline-md text-headline-md text-primary-fixed font-bold text-sm">
                    PHP {parseFloat(parsed.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Direct QR Utilities: Save to Recents & Copy QR Image */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveQR}
                  disabled={isSavingQR}
                  className={`py-2 px-2 rounded-lg font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    savedToGallery
                      ? 'bg-primary-container/20 text-primary-fixed border-primary-fixed/40'
                      : 'bg-surface-container-high text-on-surface border-outline-variant/40 hover:bg-surface-bright active:translate-y-0.5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">
                    {savedToGallery ? 'check_circle' : 'add_photo_alternate'}
                  </span>
                  <span>{savedToGallery ? 'SAVED TO PHOTOS' : isSavingQR ? 'SAVING...' : 'SAVE TO RECENTS'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyQR}
                  className={`py-2 px-2 rounded-lg font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    copiedQR
                      ? 'bg-primary-container/20 text-primary-fixed border-primary-fixed/40'
                      : 'bg-surface-container-high text-on-surface border-outline-variant/40 hover:bg-surface-bright active:translate-y-0.5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px] text-secondary">
                    {copiedQR ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedQR ? 'QR COPIED!' : 'COPY QR IMAGE'}</span>
                </button>
              </div>

              {/* Bank photo picker helpful tip */}
              <div className="bg-surface-container-high/60 px-2.5 py-1.5 rounded-lg flex items-center gap-2 border border-outline-variant/20">
                <span className="material-symbols-outlined text-[15px] text-primary flex-shrink-0">
                  tips_and_updates
                </span>
                <p className="text-[10px] text-on-surface-variant font-sans leading-tight">
                  Tapping <strong className="text-on-surface font-semibold">Launch</strong> auto-saves the QR image to Recent Photos. Inside {selectedApp.name}, tap <strong className="text-primary font-semibold">"Upload QR"</strong> to pay instantly!
                </p>
              </div>
            </div>
          </section>

          {/* Paying Bank Selector Deck */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-label-sm text-label-sm text-outline uppercase font-mono font-bold text-[11px]">
              SELECT PAYING BANK // CARTRIDGE
            </span>
            {isNative && installedAppIds.length > 0 && (
              <button
                onClick={() => setShowAllApps(!showAllApps)}
                className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
              >
                {showAllApps ? 'SHOW DETECTED ONLY' : 'SHOW ALL BANKS'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-space-xs font-mono max-h-56 overflow-y-auto pr-1">
            {displayedApps.map((app) => {
              const isSelected = selectedApp.id === app.id;
              const isInstalled = installedAppIds.includes(app.id);

              return (
                <div
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    triggerHaptic('light');
                  }}
                  className={`p-space-sm rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-surface-container-high border-primary-fixed shadow-[0_0_12px_rgba(0,240,160,0.2)]'
                      : 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-sm">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow"
                        style={{ backgroundColor: app.accentColor }}
                      >
                        {app.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-label-md text-label-md font-bold ${
                              isSelected ? 'text-primary-fixed' : 'text-on-surface'
                            }`}
                          >
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
          <div className="flex items-center justify-between px-1 py-0.5 font-mono text-label-sm">
            <button
              onClick={handleToggleDefault}
              className="flex items-center gap-1.5 text-secondary hover:text-secondary-fixed transition-colors text-[11px] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {defaultBankId === selectedApp.id ? 'check_box' : 'check_box_outline_blank'}
              </span>
              <span>ALWAYS USE {selectedApp.name.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Action Deck (Thumb Zone) */}
        <div className="flex-shrink-0 flex flex-col gap-space-xs px-margin pt-2 pb-safe border-t border-outline-variant/30 bg-surface">
          <button
            onClick={handleLaunchPayment}
            disabled={isDispatching}
            className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md font-bold py-3.5 px-space-md rounded-xl shadow-lg flex items-center justify-center gap-space-sm transition-all duration-100 active:translate-y-1 active:shadow-none uppercase cursor-pointer text-xs sm:text-sm font-mono tracking-wider hover:bg-primary-fixed"
          >
            {isDispatching ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                <span>SAVING &amp; DISPATCHING...</span>
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
            className="w-full bg-surface-container-high text-on-surface font-headline-md text-headline-md font-bold py-2.5 px-space-lg rounded-xl shadow-md transition-all duration-100 active:translate-y-0.5 uppercase tracking-wide flex items-center justify-center gap-space-xs text-xs font-mono cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>CLOSE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
