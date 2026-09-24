import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isIPad, setIsIPad] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    if (sessionStorage.getItem('pocketqr_install_dismissed')) {
      setDismissed(true);
      return;
    }

    // Android / Chromium beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS and iPadOS detection
    const userAgent = navigator.userAgent || '';
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ spoofing Mac
    const isIPadDevice =
      /iPad/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      setIsIPad(isIPadDevice);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pocketqr_install_dismissed', 'true');
  };

  if (dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in fade-in slide-in-from-bottom-5 duration-300 safe-bottom">
      <div className="p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl flex items-start gap-3 text-white">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 p-0.5 shrink-0 shadow-lg shadow-blue-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Install PocketQR App
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {isIOS
              ? isIPad
                ? 'On your iPad: tap Share ⎋ (top right) → "Add to Home Screen" for instant offline cashier presentation.'
                : 'On your iPhone: tap Share ⎋ (bottom menu) → "Add to Home Screen" for instant offline payment mode.'
              : 'Install PocketQR to your home screen for instant cold launch and 100% offline payment presentation.'}
          </p>

          {deferredPrompt && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center"
              >
                Install to Home Screen
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
