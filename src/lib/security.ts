/**
 * Security & Local Authentication helper for PocketQR.
 * Integrates native Android BiometricPrompt & native hardware vibration
 * with WebAuthn & PIN fallback for web browsers.
 */

import {
  isNativeAndroid,
  vibrateNative,
  authenticateBiometricsNative,
} from './nativeBanking';

export async function isBiometricsAvailable(): Promise<boolean> {
  if (isNativeAndroid()) return true;
  if (typeof window === 'undefined') return false;
  try {
    if (
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn('Biometrics check error:', e);
  }
  return false;
}

/**
 * Triggers biometric authentication (native Android BiometricPrompt or WebAuthn).
 */
export async function authenticateWithBiometrics(_promptReason = 'Unlock PocketQR Vault'): Promise<boolean> {
  // 1. Native Android Fingerprint / Face Unlock via BiometricPrompt
  if (isNativeAndroid()) {
    try {
      const res = await authenticateBiometricsNative();
      return res.success;
    } catch (err) {
      console.warn('Native biometric auth failed:', err);
      return false;
    }
  }

  // 2. Web browser WebAuthn fallback
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return true; // on web without biometrics, allow entry
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
        rpId: window.location.hostname || 'localhost',
      },
    });

    return !!credential;
  } catch (err: any) {
    console.info('Biometric prompt dismissed or unconfigured:', err?.message || err);
    return false;
  }
}

/**
 * Hash PIN using SHA-256 via Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`pocketqr_salt_${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify input PIN against saved hash.
 */
export async function verifyPin(inputPin: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !inputPin) return false;
  const inputHash = await hashPin(inputPin);
  return inputHash === storedHash;
}

/**
 * Tactile haptic vibration feedback respecting user's Matrix Haptic Level (OFF, LOW, NORM, MAX).
 */
export function triggerHaptic(type: 'light' | 'success' | 'warning' | 'error' = 'light'): void {
  const level = (typeof localStorage !== 'undefined' ? localStorage.getItem('pocketqr_haptic_level') : null) || 'NORM';
  if (level === 'OFF') return;

  let baseDuration = 30;
  if (type === 'light') baseDuration = 18;
  if (type === 'success') baseDuration = 35;
  if (type === 'warning') baseDuration = 45;
  if (type === 'error') baseDuration = 60;

  // Scale by level
  if (level === 'LOW') baseDuration = Math.round(baseDuration * 0.6);
  if (level === 'MAX') baseDuration = Math.round(baseDuration * 1.8);

  // 1. Native Android hardware vibrator
  if (isNativeAndroid()) {
    vibrateNative(baseDuration);
    return;
  }

  // 2. Web browser navigator.vibrate fallback
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') {
        navigator.vibrate([baseDuration, 30, baseDuration]);
      } else {
        navigator.vibrate(baseDuration);
      }
    } catch {}
  }
}
