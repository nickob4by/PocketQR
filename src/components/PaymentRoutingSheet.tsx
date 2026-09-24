import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  BookmarkPlus,
  ExternalLink,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import type { ParsedEMVCo } from '../lib/emvcoParser';
import { formatAccountNumber } from '../lib/emvcoParser';
import type { PayingBankApp } from '../types/payment';
import { PAYING_BANK_APPS } from '../types/payment';
import {
  launchBankingApp,
  getDefaultPayingBank,
  setDefaultPayingBank,
  getDirectAppScheme,
  getAppStoreUrl,
  formatPaymentSummary,
} from '../lib/deepLink';
import {
  isNativeAndroid,
  getInstalledBankingApps,
  openNativeSystemChooser,
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
    return found || PAYING_BANK_APPS[0]; // Default to GCash or saved preferred
  });

  const [copiedNumber, setCopiedNumber] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [defaultBankId, setDefaultBankId] = useState<string | null>(() => getDefaultPayingBank());
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [installedAppIds, setInstalledAppIds] = useState<string[]>([]);
  const [showAllApps, setShowAllApps] = useState(false);

  const isNative = isNativeAndroid();
  const recipientName = parsed.merchantName || 'Scanned Payee';
  const recipientNumber = parsed.accountNumber || 'Unknown Account';
  const receivingBank = parsed.bankName || (parsed.isQRPh ? 'QR Ph Network' : 'Bank / E-Wallet');

  // Auto-copy account number to clipboard immediately when sheet mounts
  useEffect(() => {
    if (parsed.accountNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(parsed.accountNumber).then(() => {
        setCopiedNumber(true);
      }).catch(() => {});
    }
  }, [parsed.accountNumber]);

  // Query installed apps on native Android
  useEffect(() => {
    if (isNative) {
      getInstalledBankingApps().then((installed) => {
        setInstalledAppIds(installed);
        // If the selected app is not installed, switch selection to the first installed one
        if (installed.length > 0 && !installed.includes(selectedApp.id)) {
          const firstInstalled = PAYING_BANK_APPS.find((a) => installed.includes(a.id));
          if (firstInstalled) {
            setSelectedApp(firstInstalled);
          }
        }
      });
    }
  }, [isNative]);

  // Displayed apps list: if native and not showing all, filter to installed only
  const displayedApps = React.useMemo(() => {
    if (isNative && !showAllApps && installedAppIds.length > 0) {
      return PAYING_BANK_APPS.filter((a) => installedAppIds.includes(a.id));
    }
    return PAYING_BANK_APPS;
  }, [isNative, showAllApps, installedAppIds]);

  // Execute deep link launch
  const executeLaunch = (appToLaunch: PayingBankApp, isAlways: boolean) => {
    if (!parsed.accountNumber) {
      onNotify('No Account Number', 'QR code payload does not contain an account number', 'error');
      return;
    }

    if (isAlways) {
      setDefaultPayingBank(appToLaunch.id);
      setDefaultBankId(appToLaunch.id);
      onNotify('Preference Saved', `${appToLaunch.name} set as default paying app`, 'info');
    }

    triggerHaptic('success');
    try {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.85 },
      });
    } catch {}

    onNotify(
      `Opening ${appToLaunch.name}...`,
      `Copied ${parsed.accountNumber} to clipboard! Paste it into Send Money.`,
      'success'
    );

    // Synchronous direct dispatch
    launchBankingApp(appToLaunch, parsed.accountNumber);
  };

  const handleJustOnce = () => {
    executeLaunch(selectedApp, false);
  };

  const handleAlways = () => {
    executeLaunch(selectedApp, true);
  };

  const handleOpenSystemChooser = async () => {
    if (parsed.accountNumber && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(parsed.accountNumber);
    }
    const appsToPass = displayedApps.length > 0 ? displayedApps : PAYING_BANK_APPS;
    openNativeSystemChooser(appsToPass);
  };

  const handleClearDefault = () => {
    setDefaultPayingBank(null);
    setDefaultBankId(null);
    triggerHaptic('light');
    onNotify('Default Cleared', 'You will be prompted to choose an app next time', 'info');
  };

  const handleCopyNumber = () => {
    if (!parsed.accountNumber) return;
    navigator.clipboard.writeText(parsed.accountNumber);
    setCopiedNumber(true);
    triggerHaptic('success');
    onNotify('Account Number Copied!', parsed.accountNumber, 'success');
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyAll = () => {
    const text = formatPaymentSummary(
      recipientName,
      recipientNumber,
      receivingBank,
      parsed.amount
    );
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    triggerHaptic('success');
    onNotify('All Payment Info Copied!', 'Ready to paste in your banking app', 'success');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleSaveCard = () => {
    const newCard: QRCardItem = {
      id: `payee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bank: parsed.detectedBank || 'other',
      bankCustomName: !parsed.detectedBank ? receivingBank : undefined,
      accountName: recipientName,
      accountNumber: parsed.accountNumber || '',
      category: 'business',
      notes: parsed.amount ? `Preset Bill: ₱${parsed.amount}` : 'Saved from Scan to Pay',
      rawPayload,
      imageDataUrl: imageDataUrl || '',
      isFavorite: false,
      orderIndex: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onSaveToWallet(newCard);
    setHasSaved(true);
    triggerHaptic('success');
    onNotify('Saved to PocketQR!', `${recipientName} added to your wallet cards`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 safe-p">
      {/* Native Android "Open with" Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-[#1e232d] border border-slate-700/60 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom duration-300">
        
        {/* Android Material Pull Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-500/60" />
        </div>

        {/* Android Header Bar */}
        <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span>Open with</span>
              <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Number copied
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose an app to pay <span className="font-semibold text-slate-200">{recipientName}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanned Payee Summary Card */}
        <div className="mx-6 p-3 rounded-2xl bg-slate-900/90 border border-slate-750 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{receivingBank}</span>
              {parsed.amount && <span className="text-amber-300 ml-1">• ₱{parsed.amount}</span>}
            </div>
            <div className="font-mono text-sm font-bold text-white tracking-wider truncate">
              {formatAccountNumber(recipientNumber, false)}
            </div>
          </div>

          <button
            onClick={handleCopyNumber}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors"
          >
            {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className={copiedNumber ? 'text-emerald-400' : ''}>
              {copiedNumber ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>

        {/* Default App Active Notice (if user chose "ALWAYS" previously) */}
        {defaultBankId && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-xl bg-blue-950/40 border border-blue-800/40 flex items-center justify-between text-xs text-blue-200 shrink-0">
            <span>
              Default: <strong className="text-white">{PAYING_BANK_APPS.find((a) => a.id === defaultBankId)?.name || 'App'}</strong> is set to always open.
            </span>
            <button
              onClick={handleClearDefault}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline ml-2 shrink-0"
            >
              Reset
            </button>
          </div>
        )}

        {/* Native Installed Apps Header Indicator */}
        {isNative && (
          <div className="mx-6 mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{installedAppIds.length} installed apps detected</span>
            </span>
            <button
              onClick={() => setShowAllApps(!showAllApps)}
              className="text-blue-400 hover:underline"
            >
              {showAllApps ? 'Show installed only' : 'Show all banks'}
            </button>
          </div>
        )}

        {/* Android Native Apps Grid */}
        <div className="flex-1 overflow-y-auto touch-scroll px-6 py-4">
          <div className="grid grid-cols-4 gap-y-4 gap-x-2">
            {displayedApps.map((app) => {
              const isSelected = selectedApp.id === app.id;
              const isDefault = defaultBankId === app.id;
              const isInstalled = !isNative || installedAppIds.includes(app.id);

              return (
                <button
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    triggerHaptic('light');
                  }}
                  onDoubleClick={() => executeLaunch(app, false)}
                  className={`flex flex-col items-center text-center p-2 rounded-2xl transition-all relative group active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600/15 ring-2 ring-blue-500 shadow-md'
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  {/* Circular Android App Icon */}
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-lg border border-white/10 text-white font-extrabold text-base tracking-wider mb-2 relative transition-transform ${
                      isSelected ? 'scale-105' : ''
                    }`}
                  >
                    <span className="drop-shadow-md">
                      {app.shortName.slice(0, 2).toUpperCase()}
                    </span>

                    {/* Installed Dot */}
                    {isNative && isInstalled && (
                      <span className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#1e232d]" />
                    )}

                    {/* Default Star Badge */}
                    {isDefault && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 rounded-full text-[9px] flex items-center justify-center font-bold shadow">
                        ★
                      </span>
                    )}
                  </div>

                  {/* App Name Label */}
                  <span
                    className={`text-[11px] font-medium leading-tight line-clamp-1 ${
                      isSelected ? 'text-blue-300 font-bold' : 'text-slate-300'
                    }`}
                  >
                    {app.shortName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fallback / Troubleshooting Options */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col items-center gap-1.5 text-center">
            {isNative ? (
              <button
                onClick={handleOpenSystemChooser}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium py-1 px-3 rounded-lg bg-blue-950/30 border border-blue-800/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open in Android System Chooser</span>
              </button>
            ) : (
              <button
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline transition-colors"
              >
                {showTroubleshoot ? 'Hide troubleshooting' : `Trouble opening ${selectedApp.shortName}?`}
              </button>
            )}

            {showTroubleshoot && !isNative && (
              <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2 w-full max-w-sm">
                <p className="text-[11px] text-slate-300 leading-normal">
                  If your phone didn't open {selectedApp.shortName}, you can install it or open the store:
                </p>
                
                <a
                  href={getAppStoreUrl(selectedApp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-medium text-xs flex items-center justify-center gap-1.5 border border-blue-500/30"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Play Store</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Android "Open with" Bottom Action Controls */}
        <div className="p-5 border-t border-slate-800 bg-[#171b23] flex flex-col gap-3 shrink-0 safe-bottom">
          {/* Native "JUST ONCE" and "ALWAYS" Buttons */}
          <div className="flex items-center gap-3">
            {/* JUST ONCE */}
            <a
              href={isNative ? '#' : getDirectAppScheme(selectedApp)}
              onClick={(e) => {
                if (isNative) e.preventDefault();
                handleJustOnce();
              }}
              className="min-h-[46px] flex-1 px-4 py-2.5 rounded-full border border-slate-600 hover:border-slate-500 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all text-center flex items-center justify-center select-none"
            >
              Just once
            </a>

            {/* ALWAYS */}
            <a
              href={isNative ? '#' : getDirectAppScheme(selectedApp)}
              onClick={(e) => {
                if (isNative) e.preventDefault();
                handleAlways();
              }}
              className="min-h-[46px] flex-1 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 active:scale-95 transition-all text-center flex items-center justify-center select-none"
            >
              Always
            </a>
          </div>

          {/* Secondary Quick Utilities */}
          <div className="flex items-center justify-between text-xs pt-1 px-1 text-slate-400">
            <button
              onClick={handleSaveCard}
              disabled={hasSaved}
              className={`hover:text-slate-200 flex items-center gap-1.5 transition-colors ${
                hasSaved ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{hasSaved ? 'Saved to Wallet' : 'Save Payee'}</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Details Copied' : 'Copy All Info'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
