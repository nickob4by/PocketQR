import type { QRCardItem, BankProvider } from '../types/qr';

/**
 * Normalizes account numbers / phone numbers for robust duplicate matching.
 * Strips whitespace, dashes, and standardizes Philippine mobile prefixes (+63 -> 0).
 */
export function normalizeAccountNumber(num?: string): string {
  if (!num) return '';
  let cleaned = num.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned.toLowerCase();
}

export interface CardMatchCandidate {
  id?: string;
  bank?: BankProvider | string;
  accountNumber?: string;
  rawPayload?: string;
}

/**
 * Checks whether a candidate card matches an existing card in the vault.
 * A card is considered a duplicate if:
 * 1. Both have an identical raw QR Ph payload string.
 * 2. Both share the same bank and normalized account/mobile number.
 */
export function findDuplicateCard(
  candidate: CardMatchCandidate,
  existingCards: QRCardItem[]
): QRCardItem | undefined {
  if (!candidate || !existingCards || existingCards.length === 0) {
    return undefined;
  }

  const candidatePayload = candidate.rawPayload?.trim();
  const candidateNormNum = normalizeAccountNumber(candidate.accountNumber);
  const candidateBank = candidate.bank;

  return existingCards.find((card) => {
    // Skip if it's the exact same card being edited
    if (candidate.id && card.id === candidate.id) {
      return false;
    }

    // 1. Exact raw QR Ph payload match
    if (candidatePayload && card.rawPayload && card.rawPayload.trim() === candidatePayload) {
      return true;
    }

    // 2. Matching bank and normalized account / mobile number
    if (
      candidateBank &&
      candidateBank === card.bank &&
      candidateNormNum &&
      candidateNormNum.length >= 6
    ) {
      const cardNormNum = normalizeAccountNumber(card.accountNumber);
      if (candidateNormNum === cardNormNum) {
        return true;
      }
    }

    return false;
  });
}
