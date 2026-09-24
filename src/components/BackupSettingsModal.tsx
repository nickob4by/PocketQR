import React, { useState, useEffect } from 'react';
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
      a.download = `PocketQR-EEPROM-Backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerHaptic('success');
      onNotify('EEPROM Backup Exported', 'JSON file downloaded to phone', 'success');
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
        onNotify('EEPROM Restored!', `Restored ${res.count} ROM cartridges`, 'success');
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
    onNotify('Defaults Loaded', 'Restored GCash, Maya, and BPI demo ROMs', 'success');
  };

  const toggleBiometrics = async () => {
    if (!biometricEnabled) {
      const verified = await authenticateWithBiometrics();
      if (verified) {
        setBiometricEnabled(true);
        localStorage.setItem('pocketqr_biometric_enabled', 'true');
        triggerHaptic('success');
        onNotify('Biometric Lock Active', 'Fingerprint / Face ID interlock engaged', 'success');
      } else {
        onNotify('Biometric Skipped', 'Device biometrics was cancelled or not enrolled', 'info');
      }
    } else {
      setBiometricEnabled(false);
      localStorage.setItem('pocketqr_biometric_enabled', 'false');
      triggerHaptic('light');
      onNotify('Biometric Lock Disengaged', '', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-surface/95 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto safe-p">
      <div className="relative w-full max-w-md bg-surface text-on-surface rounded-2xl border border-outline-variant/50 shadow-2xl p-space-md flex flex-col font-mono select-none my-auto">
        {/* Top Hardware Telemetry Strip */}
        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm pb-2 border-b border-outline-variant/30">
          <div className="flex items-center gap-space-xs">
            <span className="text-primary-fixed uppercase font-bold">SYS_CONFIG</span>
            <span className="text-outline">::</span>
            <span className="text-tertiary">SLOTS [{String(cardCount).padStart(2, '0')}/16]</span>
          </div>
          <div className="flex items-center gap-space-xs text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
            <span>INDEXED-DB</span>
          </div>
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between mt-2 mb-3">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary-fixed">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md tracking-tight text-on-surface uppercase font-bold text-sm sm:text-base">
                SYSTEM CONFIGURATION
              </h2>
              <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                HARDWARE PARAMETERS &amp; MEMORY
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface hover:text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex flex-col gap-space-md text-xs">
          {/* Bento 1: Privacy Guarantee Notice */}
          <div className="bg-surface-container-low p-space-sm rounded-xl border border-outline-variant/30 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
              shield
            </span>
            <div className="font-sans leading-relaxed text-[11px] text-on-surface-variant">
              <strong className="text-primary-fixed block font-mono text-xs uppercase mb-0.5">
                ZERO CLOUD TELEMETRY
              </strong>
              All QR codes, cryptographic EMVCo payloads, and account keys are stored 100% locally on this hardware device (IndexedDB). Zero external servers.
            </div>
          </div>

          {/* Bento 2: Display & Privacy Interlocks */}
          <div className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
              DISPLAY &amp; PRIVACY INTERLOCKS
            </span>

            {/* Mask Account Numbers Toggle */}
            <div className="flex items-center justify-between p-space-sm bg-surface-container rounded-lg border border-outline-variant/30">
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-sm font-bold text-on-surface">
                  MASK ACCOUNT DIGITS
                </span>
                <span className="font-label-sm text-[10px] text-outline mt-0.5">
                  Obscure middle characters (0917 •••• 821)
                </span>
              </div>
              <button
                type="button"
                onClick={onTogglePrivacyMask}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 border ${
                  privacyMask
                    ? 'bg-primary-container border-primary-fixed'
                    : 'bg-surface-container-high border-outline-variant'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full transition-transform ${
                    privacyMask
                      ? 'translate-x-6 bg-on-primary'
                      : 'translate-x-0 bg-outline'
                  }`}
                />
              </button>
            </div>

            {/* Biometric Lock Toggle */}
            <div className="flex items-center justify-between p-space-sm bg-surface-container rounded-lg border border-outline-variant/30">
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-headline-md text-headline-md text-sm font-bold text-on-surface">
                    BIOMETRIC HARDWARE LOCK
                  </span>
                  {biometricsSupported && (
                    <span className="bg-primary-container text-on-primary font-label-sm text-[8px] px-1 py-0.2 rounded font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <span className="font-label-sm text-[10px] text-outline mt-0.5">
                  Require Fingerprint / Face ID to open vault
                </span>
              </div>
              <button
                type="button"
                onClick={toggleBiometrics}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 border ${
                  biometricEnabled
                    ? 'bg-primary-container border-primary-fixed'
                    : 'bg-surface-container-high border-outline-variant'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full transition-transform ${
                    biometricEnabled
                      ? 'translate-x-6 bg-on-primary'
                      : 'translate-x-0 bg-outline'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Bento 3: EEPROM Memory Backup & Restore */}
          <div className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
              EEPROM BACKUP &amp; RESTORATION
            </span>
            <div className="grid grid-cols-2 gap-space-xs">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="py-2.5 px-2 bg-surface-container hover:bg-surface-bright rounded-lg border border-outline-variant/40 flex items-center justify-center gap-1.5 font-label-sm text-label-sm font-bold text-tertiary active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>{isExporting ? 'EXPORTING...' : 'EXPORT JSON'}</span>
              </button>

              <label className="py-2.5 px-2 bg-surface-container hover:bg-surface-bright rounded-lg border border-outline-variant/40 flex items-center justify-center gap-1.5 font-label-sm text-label-sm font-bold text-primary-fixed active:translate-y-0.5 transition-all cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>{isImporting ? 'PARSING...' : 'RESTORE JSON'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Bento 4: Factory Reset / Sample ROMs */}
          <div className="flex flex-col gap-1 pt-1 border-t border-outline-variant/30">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-outline uppercase font-bold">
                DIAGNOSTICS &amp; SAMPLES
              </span>
              <button
                type="button"
                onClick={handleResetSamples}
                className="text-secondary hover:text-secondary-fixed text-[11px] font-bold underline"
              >
                [ LOAD DEFAULT SAMPLES ]
              </button>
            </div>
          </div>

          {/* Done / Close Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-primary-container text-on-primary font-headline-md text-headline-md font-bold py-2.5 rounded-lg uppercase tracking-wider hover:bg-primary-fixed active:translate-y-0.5 transition-all cursor-pointer"
            >
              CLOSE CONFIG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
