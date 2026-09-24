import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { exportBackup, importBackup, resetToSampleCards } from '../lib/storage';
import { isBiometricsAvailable, authenticateWithBiometrics, triggerHaptic } from '../lib/security';

interface BackupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardCount: number;
  privacyMask: boolean;
  onTogglePrivacyMask: () => void;
  onReloadCards: () => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  isOpen,
  onClose,
  cardCount,
  privacyMask,
  onTogglePrivacyMask,
  onReloadCards,
  onNotify,
}) => {
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsSupported);
    const savedBio = localStorage.getItem('pocketqr_biometric_enabled') === 'true';
    setBiometricEnabled(savedBio);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const json = await exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `PocketQR-Backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerHaptic('success');
      onNotify('Backup Downloaded', 'Keep this file safe to restore on any phone or tablet', 'success');
    } catch (e: any) {
      onNotify('Export Failed', e?.message || 'Could not export backup', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const res = await importBackup(text);

      if (res.success) {
        onReloadCards();
        triggerHaptic('success');
        onNotify('Backup Restored!', `Successfully restored ${res.count} QR cards`, 'success');
        onClose();
      } else {
        onNotify('Restore Failed', res.error || 'Invalid backup file', 'error');
      }
    } catch (err: any) {
      onNotify('Error Reading File', err?.message || 'Failed to parse JSON', 'error');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleResetSamples = async () => {
    await resetToSampleCards();
    onReloadCards();
    triggerHaptic('success');
    onNotify('Sample Cards Loaded', 'Restored GCash, Maya, and RCBC demo cards', 'success');
  };

  const toggleBiometrics = async () => {
    if (!biometricEnabled) {
      const verified = await authenticateWithBiometrics();
      if (verified) {
        setBiometricEnabled(true);
        localStorage.setItem('pocketqr_biometric_enabled', 'true');
        triggerHaptic('success');
        onNotify('Biometric Lock Enabled', 'Fingerprint / Face ID configured', 'success');
      } else {
        onNotify('Biometric Check Skipped', 'Device biometrics was cancelled or not set up', 'info');
      }
    } else {
      setBiometricEnabled(false);
      localStorage.setItem('pocketqr_biometric_enabled', 'false');
      triggerHaptic('light');
      onNotify('Biometric Lock Disabled', '', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200 safe-p">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] modal-overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Vault Settings & Backup</h2>
              <p className="text-xs text-slate-400">IndexedDB Local Storage • 100% Private</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-6">
          {/* Privacy Guarantee Card */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-slate-300">
              <span className="font-semibold text-emerald-300 block mb-1">
                Zero Cloud Tracking & Complete Privacy
              </span>
              All QR codes, account numbers, and merchant payloads are stored 100% locally in your
              device's browser database (IndexedDB). No analytics, no server uploads, no cookies.
            </div>
          </div>

          {/* Privacy & Display Settings */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Privacy & Presentation
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-sm font-semibold text-slate-200 block">
                    Mask Account Numbers
                  </span>
                  <span className="text-xs text-slate-400">
                    Hide middle digits (e.g. 0917 •••• 123) until tapped
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onTogglePrivacyMask}
                  className={`min-h-[44px] w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${
                    privacyMask ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full bg-white transition-transform ${
                      privacyMask ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Biometrics Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-200">
                      Biometric / Passkey Lock
                    </span>
                    {biometricsSupported && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-medium">
                        Device Supported
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    Require Touch ID / Face ID / Android Biometrics to open vault
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleBiometrics}
                  className={`min-h-[44px] w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${
                    biometricEnabled ? 'bg-emerald-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full bg-white transition-transform ${
                      biometricEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Backup & Portability */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Backup & Portability
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Export Button */}
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="min-h-[48px] flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-left transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 block">Export Backup</span>
                  <span className="text-[11px] text-slate-400">Save {cardCount} cards to .JSON</span>
                </div>
              </button>

              {/* Import Button */}
              <label className="min-h-[48px] flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-left transition-all group cursor-pointer">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImport}
                  disabled={isImporting}
                  className="hidden"
                />
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-200 block">Restore Backup</span>
                  <span className="text-[11px] text-slate-400">Import .JSON file</span>
                </div>
              </label>
            </div>
          </div>

          {/* Manage Sample Data */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Data Management
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleResetSamples}
                className="min-h-[48px] w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:bg-slate-850 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  <span className="text-xs sm:text-sm font-medium text-slate-300">
                    Reload Philippine Demo Cards (GCash, Maya, RCBC)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 uppercase font-mono">Demo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <span className="text-[11px] text-slate-500">PocketQR v1.0.0 • Local PWA</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
