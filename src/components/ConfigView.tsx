import React, { useState, useEffect, useRef } from 'react';
import { exportBackup, importBackup, resetToSampleCards, clearAllCards } from '../lib/storage';
import { isBiometricsAvailable, authenticateWithBiometrics, triggerHaptic } from '../lib/security';

interface ConfigViewProps {
  cardCount: number;
  privacyMask: boolean;
  onTogglePrivacyMask: () => void;
  onReloadCards: () => void;
  onNotify: (title: string, description?: string, type?: 'success' | 'info' | 'error') => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  cardCount,
  privacyMask,
  onTogglePrivacyMask,
  onReloadCards,
  onNotify,
}) => {
  // Display & Haptics Rig State
  const [crtScanline, setCrtScanline] = useState<boolean>(() => {
    return localStorage.getItem('pocketqr_crt_scanlines') === 'true';
  });
  const [oledBlack, setOledBlack] = useState<boolean>(() => {
    return localStorage.getItem('pocketqr_oled_black') === 'true';
  });
  const [hapticLevel, setHapticLevel] = useState<'OFF' | 'LOW' | 'NORM' | 'MAX'>(() => {
    return (localStorage.getItem('pocketqr_haptic_level') as any) || 'NORM';
  });
  const [themeTone, setThemeTone] = useState<'MINT' | 'AMBER' | 'CYAN'>(() => {
    return (localStorage.getItem('pocketqr_theme_tone') as any) || 'MINT';
  });

  // Security & Enclave State
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lockoutInterval, setLockoutInterval] = useState<'30s' | '2m' | '5m'>(() => {
    return (localStorage.getItem('pocketqr_lockout_interval') as any) || '30s';
  });
  const [isoBoost, setIsoBoost] = useState<boolean>(() => {
    return localStorage.getItem('pocketqr_iso_boost') !== 'false';
  });

  // Purge Confirmation Modal
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  // Floating Flash Telemetry Micro-Notice
  const [flashNotice, setFlashNotice] = useState<string | null>(null);
  const flashTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsSupported);
    const savedBio = localStorage.getItem('pocketqr_biometric_enabled') === 'true';
    setBiometricEnabled(savedBio);
  }, []);

  // Flash micro-notice trigger
  const triggerFlash = (text: string) => {
    setFlashNotice(text);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashNotice(null);
    }, 2400);
  };

  // CRT Scanline Toggle
  const handleToggleCrt = () => {
    const next = !crtScanline;
    setCrtScanline(next);
    localStorage.setItem('pocketqr_crt_scanlines', next ? 'true' : 'false');
    if (next) {
      document.body.classList.add('crt-scanlines');
    } else {
      document.body.classList.remove('crt-scanlines');
    }
    triggerHaptic('light');
    triggerFlash(`BUS_UPDATE // CRT_SCANLINES: ${next ? 'ENGAGED' : 'DISENGAGED'}`);
  };

  // OLED Contrast Toggle
  const handleToggleOled = () => {
    const next = !oledBlack;
    setOledBlack(next);
    localStorage.setItem('pocketqr_oled_black', next ? 'true' : 'false');
    if (next) {
      document.documentElement.classList.add('oled-deep-black');
    } else {
      document.documentElement.classList.remove('oled-deep-black');
    }
    triggerHaptic('light');
    triggerFlash(`BUS_UPDATE // OLED_CONTRAST: ${next ? 'DEEP_0NIT' : 'STANDARD'}`);
  };

  // Haptic Actuator Selector
  const handleSetHaptic = (level: 'OFF' | 'LOW' | 'NORM' | 'MAX') => {
    setHapticLevel(level);
    localStorage.setItem('pocketqr_haptic_level', level);
    if (level === 'OFF') {
      // no pulse
    } else if (level === 'LOW') {
      triggerHaptic('light');
    } else if (level === 'NORM') {
      triggerHaptic('light');
    } else {
      triggerHaptic('warning');
    }
    triggerFlash(`HAPTIC ACTUATOR CALIBRATED: ${level}`);
  };

  // Theme Tone Selector
  const handleSetThemeTone = (tone: 'MINT' | 'AMBER' | 'CYAN', label: string) => {
    setThemeTone(tone);
    localStorage.setItem('pocketqr_theme_tone', tone);
    triggerHaptic('light');
    triggerFlash(`PHOSPHOR MATRIX TUNED: ${label}`);
  };

  // Biometrics Interlock Toggle
  const handleToggleBiometrics = async () => {
    if (!biometricEnabled) {
      const verified = await authenticateWithBiometrics();
      if (verified) {
        setBiometricEnabled(true);
        localStorage.setItem('pocketqr_biometric_enabled', 'true');
        triggerHaptic('success');
        triggerFlash('ENCLAVE_ARMED // BIOMETRIC INTERLOCK ENGAGED');
        onNotify('Biometric Lock Active', 'Fingerprint / Face ID interlock engaged', 'success');
      } else {
        triggerFlash('INTERLOCK_ABORTED // FAILED OR CANCELLED');
        onNotify('Biometric Skipped', 'Authentication cancelled or not enrolled', 'info');
      }
    } else {
      setBiometricEnabled(false);
      localStorage.setItem('pocketqr_biometric_enabled', 'false');
      triggerHaptic('light');
      triggerFlash('BUS_UPDATE // BIOMETRIC INTERLOCK DISENGAGED');
      onNotify('Biometric Lock Disengaged', '', 'info');
    }
  };

  // Timeout Watchdog Option
  const handleSetTimeout = (opt: '30s' | '2m' | '5m', label: string) => {
    setLockoutInterval(opt);
    localStorage.setItem('pocketqr_lockout_interval', opt);
    triggerHaptic('light');
    triggerFlash(`LOCKOUT WATCHDOG SET: ${label}`);
  };

  // Optical ISO Boost Toggle
  const handleToggleIso = () => {
    const next = !isoBoost;
    setIsoBoost(next);
    localStorage.setItem('pocketqr_iso_boost', next ? 'true' : 'false');
    triggerHaptic('light');
    triggerFlash(`BUS_UPDATE // OPTIC_ISO_STROBE: ${next ? 'ENGAGED' : 'DISENGAGED'}`);
  };

  // Export Cartridges Backup (.BIN / .JSON)
  const handleExport = async () => {
    try {
      triggerFlash('DUMPING ENCRYPTED .BIN MATRIX TO SECURE STORAGE...');
      const json = await exportBackup();
      const blob = new Blob([json], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `PocketQR-Cartridges-${dateStr}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerHaptic('success');
      triggerFlash('EEPROM ARCHIVE EXPORT COMPLETED');
      onNotify('EEPROM Backup Dumped', 'Vault cartridges archived successfully', 'success');
    } catch (e: any) {
      onNotify('Dump Failed', e?.message || 'Could not export backup', 'error');
    }
  };

  // Restore Cartridges Backup
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      triggerFlash('READING QRPH COMPLIANT CART ARCHIVE...');
      const text = await file.text();
      const res = await importBackup(text);

      if (res.success) {
        onReloadCards();
        triggerHaptic('success');
        triggerFlash(`EEPROM RESTORED: ${res.count} ROM SLOTS MOUNTED`);
        onNotify('EEPROM Restored!', `Restored ${res.count} ROM cartridges`, 'success');
      } else {
        triggerFlash('RESTORE_ERR // INVALID CARTRIDGE HEADER');
        onNotify('Restore Failed', res.error || 'Invalid backup file', 'error');
      }
    } catch (err: any) {
      onNotify('Error Reading File', err?.message || 'Failed to parse file', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Restore Sample Defaults
  const handleResetDefaults = async () => {
    await resetToSampleCards();
    onReloadCards();
    triggerHaptic('success');
    triggerFlash('DEFAULT CART MATRIX FLASHED TO ROM');
    onNotify('Defaults Loaded', 'Restored GCash, Maya, and BPI cartridges', 'success');
  };

  // Purge Volatile Storage
  const handleExecutePurge = async () => {
    setShowPurgeConfirm(false);
    await clearAllCards();
    onReloadCards();
    triggerHaptic('warning');
    triggerFlash('VOLATILE EEPROM ZEROED // 0 SLOTS ACTIVE');
    onNotify('Memory Scrubbed', 'All bank slots and cryptographic keys zero-filled', 'info');
  };

  const sramUsedPercent = Math.min(100, Math.round((cardCount / 16) * 100 * 10) / 10);

  return (
    <div className="flex flex-col w-full gap-space-lg select-none pb-28 pt-2">
      {/* SYSTEM TELEMETRY HUD CARD */}
      <div className="relative w-full rounded-xl bg-surface-container-low p-space-md shadow-md overflow-hidden border border-outline-variant/30">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary-container/5 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex items-start justify-between gap-space-sm mb-space-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs text-primary-fixed font-label-md text-label-md">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(0,240,160,0.8)]"></span>
              <span>CONFIG // SYS_PARAMS</span>
            </div>
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight uppercase mt-0.5">
              HARDWARE CONTROL
            </span>
          </div>
          <div className="px-2 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm tracking-wider border border-primary/20">
            CORE-01 // OK
          </div>
        </div>

        {/* Telemetry Badges Strip */}
        <div className="grid grid-cols-3 gap-space-xs pt-space-xs bg-surface-container-lowest/80 rounded-lg p-space-xs border border-outline-variant/20">
          <div className="flex flex-col p-1.5 rounded bg-surface-container">
            <span className="text-on-surface-variant font-label-sm text-label-sm">KERNEL</span>
            <span className="text-primary-fixed font-label-md text-label-md truncate">v1.0.5-APK</span>
          </div>
          <div className="flex flex-col p-1.5 rounded bg-surface-container">
            <span className="text-on-surface-variant font-label-sm text-label-sm">SRAM USED</span>
            <div className="flex items-center gap-1">
              <span className="text-tertiary-fixed font-label-md text-label-md">
                {sramUsedPercent}%
              </span>
            </div>
          </div>
          <div className="flex flex-col p-1.5 rounded bg-surface-container">
            <span className="text-on-surface-variant font-label-sm text-label-sm">VOLTAGE</span>
            <span className="text-secondary font-label-md text-label-md">3.88V NOM</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: HARDWARE & DISPLAY SETTINGS */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">tune</span>
            <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">
              01 // DISPLAY &amp; HAPTICS RIG
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">PPU.CHIP_88</span>
        </div>

        <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-sm shadow-sm border border-outline-variant/20">
          {/* CRT Scanline Filter Toggle */}
          <div className="flex items-center justify-between p-space-md rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-fixed flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">tv</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  CRT Scanline Emulation
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Phosphor green interlaced aperture grille
                </span>
              </div>
            </div>

            {/* Hardware Style Toggle Switch */}
            <button
              onClick={handleToggleCrt}
              className={`relative w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 shadow-inner ${
                crtScanline ? 'bg-primary-container' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`switch-knob w-6 h-6 rounded-full flex items-center justify-center shadow-md transform transition-transform duration-200 ${
                  crtScanline ? 'translate-x-5 bg-on-primary-container' : 'translate-x-0 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${crtScanline ? 'bg-primary' : 'bg-outline'}`}></div>
              </div>
            </button>
          </div>

          {/* OLED Contrast Mode Toggle */}
          <div className="flex items-center justify-between p-space-md rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-tertiary-fixed flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">contrast</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  Pure OLED Black Canvas
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Shut down inactive sub-pixels for battery runtime
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleOled}
              className={`relative w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 shadow-inner ${
                oledBlack ? 'bg-primary-container' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`switch-knob w-6 h-6 rounded-full flex items-center justify-center shadow-md transform transition-transform duration-200 ${
                  oledBlack ? 'translate-x-5 bg-on-primary-container' : 'translate-x-0 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${oledBlack ? 'bg-primary' : 'bg-outline'}`}></div>
              </div>
            </button>
          </div>

          {/* Matrix Haptic Feedback Selector */}
          <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">vibration</span>
                <span className="font-headline-md text-headline-md text-on-surface text-[15px]">
                  Matrix Haptic Feedback
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">
                TACTILE_{hapticLevel}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant mb-1">
              ERM Linear Actuator click weight on trigger press
            </span>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleSetHaptic('OFF')}
                className={`py-2 px-1 rounded-DEFAULT font-label-sm text-label-sm transition-all active:translate-y-0.5 uppercase tracking-wider text-center cursor-pointer ${
                  hapticLevel === 'OFF'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                [OFF]
              </button>
              <button
                type="button"
                onClick={() => handleSetHaptic('LOW')}
                className={`py-2 px-1 rounded-DEFAULT font-label-sm text-label-sm transition-all active:translate-y-0.5 uppercase tracking-wider text-center cursor-pointer ${
                  hapticLevel === 'LOW'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                [LOW]
              </button>
              <button
                type="button"
                onClick={() => handleSetHaptic('NORM')}
                className={`py-2 px-1 rounded-DEFAULT font-label-sm text-label-sm transition-all active:translate-y-0.5 uppercase tracking-wider text-center cursor-pointer ${
                  hapticLevel === 'NORM'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                [NORM]
              </button>
              <button
                type="button"
                onClick={() => handleSetHaptic('MAX')}
                className={`py-2 px-1 rounded-DEFAULT font-label-sm text-label-sm transition-all active:translate-y-0.5 uppercase tracking-wider text-center cursor-pointer ${
                  hapticLevel === 'MAX'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                [TURBO]
              </button>
            </div>
          </div>

          {/* Display Theme Tone Palette Selector */}
          <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">palette</span>
                <span className="font-headline-md text-headline-md text-on-surface text-[15px]">
                  Phosphor Colorway
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">
                {themeTone === 'MINT' ? 'MINT 520NM' : themeTone === 'AMBER' ? 'AMBER 590NM' : 'CYAN 470NM'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Mint Theme */}
              <button
                type="button"
                onClick={() => handleSetThemeTone('MINT', 'MINT 520NM')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-transform active:translate-y-0.5 cursor-pointer ${
                  themeTone === 'MINT'
                    ? 'bg-surface-container-highest shadow-sm'
                    : 'bg-surface-container-high opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center">
                  {themeTone === 'MINT' && (
                    <span className="material-symbols-outlined text-[14px] text-on-primary-container font-bold">check</span>
                  )}
                </div>
                <span className="font-label-sm text-label-sm text-primary-fixed text-center uppercase tracking-tight">
                  MINT PHOSPHOR
                </span>
              </button>

              {/* Amber Theme */}
              <button
                type="button"
                onClick={() => handleSetThemeTone('AMBER', 'AMBER 590NM')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-transform active:translate-y-0.5 cursor-pointer ${
                  themeTone === 'AMBER'
                    ? 'bg-surface-container-highest shadow-sm'
                    : 'bg-surface-container-high opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
                  {themeTone === 'AMBER' && (
                    <span className="material-symbols-outlined text-[14px] text-on-secondary-container font-bold">check</span>
                  )}
                </div>
                <span className="font-label-sm text-label-sm text-secondary-fixed text-center uppercase tracking-tight">
                  AMBER DECK
                </span>
              </button>

              {/* Cyan Theme */}
              <button
                type="button"
                onClick={() => handleSetThemeTone('CYAN', 'CYAN 470NM')}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-transform active:translate-y-0.5 cursor-pointer ${
                  themeTone === 'CYAN'
                    ? 'bg-surface-container-highest shadow-sm'
                    : 'bg-surface-container-high opacity-70 hover:opacity-100'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-tertiary-container flex items-center justify-center">
                  {themeTone === 'CYAN' && (
                    <span className="material-symbols-outlined text-[14px] text-on-tertiary-container font-bold">check</span>
                  )}
                </div>
                <span className="font-label-sm text-label-sm text-tertiary-fixed text-center uppercase tracking-tight">
                  TERMINAL CYAN
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: VAULT & SECURITY CONTROLS */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">verified_user</span>
            <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">
              02 // CRYPTO &amp; VAULT ENCLAVE
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-primary">ENCLAVE_ARMED</span>
        </div>

        <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-sm shadow-sm border border-outline-variant/20">
          {/* Biometric PIN / Hardware Key */}
          <div className="flex items-center justify-between p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-fixed flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">fingerprint</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                    Biometric Deck Interlock
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-primary-fixed font-label-sm text-[8px] uppercase">
                    {biometricsSupported ? 'FIDO2' : 'PIN_FALLBACK'}
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Require fingerprint before broadcasting rails
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleBiometrics}
              className={`relative w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 shadow-inner ${
                biometricEnabled ? 'bg-primary-container' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`switch-knob w-6 h-6 rounded-full flex items-center justify-center shadow-md transform transition-transform duration-200 ${
                  biometricEnabled ? 'translate-x-5 bg-on-primary-container' : 'translate-x-0 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${biometricEnabled ? 'bg-primary' : 'bg-outline'}`}></div>
              </div>
            </button>
          </div>

          {/* Stealth Mode Balance Masking */}
          <div className="flex items-center justify-between p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary-container flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">visibility_off</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                    Stealth Balance Masking
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-secondary-container/20 text-secondary-fixed-dim font-label-sm text-[8px] uppercase font-bold">
                    {privacyMask ? 'ENFORCED' : 'OFF'}
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Mask account digits as [••••••••] across public views
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onTogglePrivacyMask();
                triggerFlash(`STEALTH_MASK: ${!privacyMask ? 'ENFORCED' : 'REVEALED'}`);
              }}
              className={`relative w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 shadow-inner ${
                privacyMask ? 'bg-primary-container' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`switch-knob w-6 h-6 rounded-full flex items-center justify-center shadow-md transform transition-transform duration-200 ${
                  privacyMask ? 'translate-x-5 bg-on-primary-container' : 'translate-x-0 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${privacyMask ? 'bg-primary' : 'bg-outline'}`}></div>
              </div>
            </button>
          </div>

          {/* Auto Timeout Lockout */}
          <div className="flex flex-col gap-space-xs p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">timer</span>
                <span className="font-headline-md text-headline-md text-on-surface text-[15px]">
                  Enclave Auto-Lockout Interval
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-tertiary">SESSION_WATCHDOG</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSetTimeout('30s', '30 SECONDS')}
                className={`py-2 px-2 rounded-DEFAULT font-label-sm text-label-sm tracking-wider uppercase text-center active:translate-y-0.5 cursor-pointer ${
                  lockoutInterval === '30s'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                30 SECONDS
              </button>
              <button
                type="button"
                onClick={() => handleSetTimeout('2m', '2 MINUTES')}
                className={`py-2 px-2 rounded-DEFAULT font-label-sm text-label-sm tracking-wider uppercase text-center active:translate-y-0.5 cursor-pointer ${
                  lockoutInterval === '2m'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                2 MINUTES
              </button>
              <button
                type="button"
                onClick={() => handleSetTimeout('5m', '5 MINUTES')}
                className={`py-2 px-2 rounded-DEFAULT font-label-sm text-label-sm tracking-wider uppercase text-center active:translate-y-0.5 cursor-pointer ${
                  lockoutInterval === '5m'
                    ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_2px_0_0_#006843]'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                5 MINUTES
              </button>
            </div>
          </div>

          {/* Optical Scanner Sensor Tuning */}
          <div className="flex items-center justify-between p-space-md rounded-lg bg-surface-container">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-fixed flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">center_focus_strong</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  Optical ISO Strobe Boost
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Aggressive thresholding for damaged or low-light QR
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleIso}
              className={`relative w-12 h-7 rounded-full p-0.5 transition-colors cursor-pointer flex-shrink-0 shadow-inner ${
                isoBoost ? 'bg-primary-container' : 'bg-surface-container-high'
              }`}
            >
              <div
                className={`switch-knob w-6 h-6 rounded-full flex items-center justify-center shadow-md transform transition-transform duration-200 ${
                  isoBoost ? 'translate-x-5 bg-on-primary-container' : 'translate-x-0 bg-surface-container-lowest'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isoBoost ? 'bg-primary' : 'bg-outline'}`}></div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: BANK RAILS & DATA STORAGE */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">developer_board</span>
            <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">
              03 // EEPROM &amp; CARTRIDGE DATA
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-outline">STORAGE://LOCAL</span>
        </div>

        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-sm shadow-sm border border-outline-variant/20">
          {/* Backup ROM Action Button */}
          <button
            type="button"
            onClick={handleExport}
            className="w-full flex items-center justify-between p-space-md rounded-lg bg-surface-container hover:bg-surface-container-high transition-transform active:translate-y-0.5 group text-left cursor-pointer"
          >
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-fixed flex-shrink-0 group-hover:text-primary">
                <span className="material-symbols-outlined text-[22px]">save</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  Dump Vault Cartridges (.BIN)
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Export AES-256 encrypted payload to SD storage
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-primary-fixed group-hover:translate-x-1 transition-transform">
              download
            </span>
          </button>

          {/* Restore Archive Action Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-space-md rounded-lg bg-surface-container hover:bg-surface-container-high transition-transform active:translate-y-0.5 group text-left cursor-pointer"
          >
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-tertiary-fixed flex-shrink-0 group-hover:text-tertiary">
                <span className="material-symbols-outlined text-[22px]">upload_file</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  Restore Cartridge Archive
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Parse external QR Ph bank rails &amp; merchant tokens
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-tertiary-fixed group-hover:translate-x-1 transition-transform">
              upload
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.bin"
            onChange={handleImport}
            className="hidden"
          />

          {/* Reset Demo ROMs Button */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="w-full flex items-center justify-between p-space-md rounded-lg bg-surface-container hover:bg-surface-container-high transition-transform active:translate-y-0.5 group text-left cursor-pointer"
          >
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary-container flex-shrink-0">
                <span className="material-symbols-outlined text-[22px]">restart_alt</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-on-surface text-[15px] leading-tight">
                  Flash Factory Demo Cartridges
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Restore Philippine default bank cartridges (GCash, Maya, BPI)
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-secondary-container group-hover:translate-x-1 transition-transform">
              refresh
            </span>
          </button>

          {/* Destructive Wipe Button */}
          <div className="pt-space-xs">
            <button
              type="button"
              onClick={() => setShowPurgeConfirm(true)}
              className="w-full relative overflow-hidden rounded-lg bg-surface-container-lowest p-space-md flex items-center justify-between group active:translate-y-0.5 transition-transform text-left cursor-pointer border border-error/30"
            >
              {/* Cyber Warning Accent Bar */}
              <div className="absolute inset-y-0 left-0 w-1.5 bg-error"></div>
              <div className="flex items-center gap-space-md pl-1">
                <div className="w-10 h-10 rounded-lg bg-error-container/30 flex items-center justify-center text-error flex-shrink-0">
                  <span className="material-symbols-outlined text-[22px]">delete_forever</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-md text-headline-md text-error text-[15px] leading-tight">
                      Purge Volatile Storage
                    </span>
                    <span className="font-label-sm text-[8px] bg-error-container text-on-error-container px-1 py-0.5 rounded font-bold uppercase">
                      ZERO-FILL
                    </span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Scrub all bank slots, GCash, Maya, and BPI keys
                  </span>
                </div>
              </div>
              <div className="px-2 py-1 rounded bg-error-container/20 text-error font-label-sm text-label-sm tracking-widest font-bold">
                PURGE
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: HARDWARE TELEMETRY & SYSTEM ABOUT */}
      <div className="flex flex-col gap-space-sm pb-space-sm">
        <div className="flex items-center justify-between px-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">terminal</span>
            <span className="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">
              04 // HARDWARE TELEMETRY
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">BSP-SPEC // CERT</span>
        </div>

        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-sm border border-outline-variant/20">
          {/* Diagnostic Sensor Quad Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-highest">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                <span className="font-label-sm text-label-sm text-on-surface">LOC_GPS</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">[OFF]</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-highest">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_rgba(0,240,160,0.8)]"></span>
                <span className="font-label-sm text-label-sm text-on-surface">NFC_CHIP</span>
              </div>
              <span className="font-label-sm text-label-sm text-primary">[ARMED]</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-highest">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_rgba(0,240,160,0.8)]"></span>
                <span className="font-label-sm text-label-sm text-on-surface">OPTIC_CAM</span>
              </div>
              <span className="font-label-sm text-label-sm text-primary">[ONLINE]</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-highest">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container shadow-[0_0_6px_rgba(130,223,255,0.8)]"></span>
                <span className="font-label-sm text-label-sm text-on-surface">CRYPTO_ENG</span>
              </div>
              <span className="font-label-sm text-label-sm text-tertiary">[GCM-256]</span>
            </div>
          </div>

          {/* Spec & Standards Info Rows */}
          <div className="flex flex-col divide-y divide-outline-variant/10 gap-2 pt-1 font-mono">
            <div className="flex items-center justify-between text-body-sm font-body-sm">
              <span className="text-on-surface-variant">HOST RIG IDENTITY</span>
              <span className="text-on-surface font-label-sm text-label-sm uppercase">POCKET_CYBER_DECK_T1</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-body-sm pt-2">
              <span className="text-on-surface-variant">NATIONAL QR STANDARD</span>
              <span className="text-primary-fixed font-label-sm text-label-sm">QRPH SPEC v2.1 (BSP)</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-body-sm pt-2">
              <span className="text-on-surface-variant">DECK OS REVISION</span>
              <span className="text-on-surface font-label-sm text-label-sm">BUILD #2024.11.08</span>
            </div>
            <div className="flex items-center justify-between text-body-sm font-body-sm pt-2">
              <span className="text-on-surface-variant">EEPROM INTEGRITY</span>
              <span className="text-primary font-label-sm text-label-sm font-bold">CHECKSUM // 0x9F4C MATCH</span>
            </div>
          </div>

          {/* Retro Bottom Barcode / Serial */}
          <div className="flex items-center justify-between pt-2 px-1 border-t border-outline-variant/20">
            <div className="flex items-center gap-1 opacity-70">
              <div className="w-1 h-5 bg-outline"></div>
              <div className="w-0.5 h-5 bg-outline"></div>
              <div className="w-2 h-5 bg-outline"></div>
              <div className="w-0.5 h-5 bg-outline"></div>
              <div className="w-1.5 h-5 bg-outline"></div>
              <div className="w-0.5 h-5 bg-outline"></div>
              <div className="w-2.5 h-5 bg-outline"></div>
              <div className="w-1 h-5 bg-outline"></div>
            </div>
            <span className="font-label-sm text-label-sm text-outline tracking-widest">
              SN: 7720-PKT-QR-MNL
            </span>
          </div>
        </div>
      </div>

      {/* CONFIRM ZERO-OUT PURGE MODAL */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-xl bg-surface-container p-space-lg shadow-2xl border border-error/50 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-error-container/30 text-error flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <span className="font-label-sm text-label-sm text-error uppercase tracking-wider font-bold">
              SECURITY CONFIRMATION REQUIRED
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface uppercase font-bold mt-1">
              ZERO-FILL ALL SLOTS?
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              This will permanently scrub all {cardCount} stored bank cartridges, GCash, Maya, and keys from your phone. This action cannot be reversed.
            </p>
            <div className="flex gap-2 w-full mt-5">
              <button
                type="button"
                onClick={() => setShowPurgeConfirm(false)}
                className="flex-1 py-2.5 rounded bg-surface-container-high text-on-surface font-label-md uppercase cursor-pointer"
              >
                ABORT
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                className="flex-1 py-2.5 rounded bg-error text-on-error font-label-md font-bold uppercase shadow-[0_2px_0_0_#93000a] active:translate-y-0.5 cursor-pointer"
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING FLASH TELEMETRY NOTICE (INTERACTIVE MICRO-FEEDBACK) */}
      <div
        id="flash-notice"
        className={`fixed bottom-24 left-4 right-4 z-40 p-space-md rounded-lg bg-surface-container-highest text-primary-fixed font-label-sm text-label-sm flex items-center justify-between shadow-2xl transition-opacity duration-300 border border-primary-fixed-dim/30 ${
          flashNotice ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
          <span id="flash-notice-text">{flashNotice || 'OPERATION EXECUTED'}</span>
        </div>
        <span className="text-outline font-label-sm text-[8px]">[ACK]</span>
      </div>
    </div>
  );
};
