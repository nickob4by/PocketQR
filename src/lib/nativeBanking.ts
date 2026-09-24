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
