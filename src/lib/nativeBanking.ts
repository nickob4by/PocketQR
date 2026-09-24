import { registerPlugin, Capacitor } from '@capacitor/core';
import type { PayingBankApp } from '../types/payment';
import { PAYING_BANK_APPS } from '../types/payment';

interface BankingAppPluginInterface {
  getInstalledApps(options: {
    apps: Array<{ id: string; androidPackage: string; scheme: string }>;
  }): Promise<{ installedApps: string[] }>;
  launchApp(options: {
    androidPackage: string;
    scheme: string;
  }): Promise<{ success: boolean }>;
  openNativeChooser(options: {
    apps: Array<{ id: string; androidPackage: string; scheme: string }>;
  }): Promise<{ success: boolean }>;
  saveImageToGallery(options: {
    base64: string;
    fileName?: string;
    isTemporary?: boolean;
  }): Promise<{ success: boolean; uri?: string; isTemporary?: boolean }>;
  cleanupTemporaryQRs(): Promise<{ success: boolean }>;
  copyImageToClipboard(options: {
    base64?: string;
    text?: string;
  }): Promise<{ success: boolean }>;
  shareImage(options: {
    base64: string;
    title?: string;
    text?: string;
  }): Promise<{ success: boolean }>;
  vibrate(options: { duration: number }): Promise<void>;
  authenticateBiometrics(): Promise<{ success: boolean; cancelled?: boolean; error?: string; unsecured?: boolean }>;
}

const BankingApp = registerPlugin<BankingAppPluginInterface>('BankingApp');

/**
 * Returns true if the app is running as an installed native Android APK.
 */
export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Queries Android's PackageManager to return the list of installed banking app IDs.
 * Returns all apps if running on the web or if error occurs.
 */
export async function getInstalledBankingApps(): Promise<string[]> {
  if (!isNativeAndroid()) {
    // On web, return all supported banking apps
    return PAYING_BANK_APPS.map((a) => a.id);
  }

  try {
    const res = await BankingApp.getInstalledApps({
      apps: PAYING_BANK_APPS.map((a) => ({
        id: a.id,
        androidPackage: a.androidPackage,
        scheme: a.scheme,
      })),
    });

    return res.installedApps || [];
  } catch (err) {
    console.warn('Native getInstalledApps failed, falling back to all:', err);
    return PAYING_BANK_APPS.map((a) => a.id);
  }
}

/**
 * Directly launches the banking app via Android's native startActivity.
 */
export async function launchNativeApp(app: PayingBankApp): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    const res = await BankingApp.launchApp({
      androidPackage: app.androidPackage,
      scheme: app.scheme,
    });
    return res.success;
  } catch (err) {
    console.warn('Native launchApp failed:', err);
    return false;
  }
}

/**
 * Triggers Android's native system Intent.createChooser bottom sheet!
 */
export async function openNativeSystemChooser(apps: PayingBankApp[]): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    const res = await BankingApp.openNativeChooser({
      apps: apps.map((a) => ({
        id: a.id,
        androidPackage: a.androidPackage,
        scheme: a.scheme,
      })),
    });
    return res.success;
  } catch (err) {
    console.warn('Native openNativeChooser failed:', err);
    return false;
  }
}

/**
 * Saves a base64 image directly to Android's MediaStore (Pictures/PocketQR)
 * so it immediately appears in the photo gallery / Recent Photos for banking apps.
 */
export async function saveImageToGalleryNative(
  base64: string,
  fileName?: string,
  isTemporary = true
): Promise<{ success: boolean; uri?: string; isTemporary?: boolean }> {
  if (!isNativeAndroid()) {
    return { success: false };
  }

  try {
    return await BankingApp.saveImageToGallery({ base64, fileName, isTemporary });
  } catch (err) {
    console.warn('Native saveImageToGallery failed:', err);
    return { success: false };
  }
}

/**
 * Purges any temporary QR images created by PocketQR in the native gallery.
 */
export async function cleanupTemporaryQRsNative(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const res = await BankingApp.cleanupTemporaryQRs();
    return res.success;
  } catch {
    return false;
  }
}

/**
 * Copies a QR image and/or text to the native Android clipboard.
 */
export async function copyImageToClipboardNative(base64?: string, text?: string): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    const res = await BankingApp.copyImageToClipboard({ base64, text });
    return res.success;
  } catch (err) {
    console.warn('Native copyImageToClipboard failed:', err);
    return false;
  }
}

/**
 * Launches Android's native share sheet with the QR image.
 */
export async function shareImageNative(base64: string, title?: string, text?: string): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    const res = await BankingApp.shareImage({ base64, title, text });
    return res.success;
  } catch (err) {
    console.warn('Native shareImage failed:', err);
    return false;
  }
}

/**
 * Triggers tactile vibration on native Android hardware.
 */
export async function vibrateNative(duration = 25): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    await BankingApp.vibrate({ duration });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts native Android system BiometricPrompt (Fingerprint / Face Unlock).
 */
export async function authenticateBiometricsNative(): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!isNativeAndroid()) {
    return { success: true };
  }

  try {
    return await BankingApp.authenticateBiometrics();
  } catch (err: any) {
    console.warn('Native biometric error:', err);
    return { success: false, error: err.message };
  }
}
