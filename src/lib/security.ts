/**
 * Security & Local Authentication helper for PocketQR.
 * Supports WebAuthn platform biometrics (TouchID, FaceID, Windows Hello, Android Biometrics)
 * and simple 4-digit PIN fallback.
 */

export async function isBiometricsAvailable(): Promise<boolean> {
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
 * Triggers a WebAuthn biometric prompt.
 * Generates an ephemeral challenge so it works purely client-side without a server!
 */
export async function authenticateWithBiometrics(_promptReason = 'Unlock PocketQR Vault'): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Prompt user verification
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
      },
    });

    return !!credential;
  } catch (err: any) {
    // If user cancelled, or credentials.get is not yet registered, fall back gracefully
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
 * Safe haptic vibration feedback.
 */
export function triggerHaptic(type: 'light' | 'success' | 'warning' | 'error' = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'success':
        navigator.vibrate([20, 40, 20]);
        break;
      case 'warning':
        navigator.vibrate([40, 30, 40]);
        break;
      case 'error':
        navigator.vibrate([60, 50, 60, 50, 80]);
        break;
    }
  } catch {
    // Vibration ignored if user gesture or permission is missing
  }
}
