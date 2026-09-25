import type { BankProvider } from '../types/qr';
import { BANK_CONFIGS } from '../types/qr';

export interface ParsedEMVCo {
  isValid: boolean;
  isQRPh: boolean;
  merchantName?: string;
  accountNumber?: string;
  detectedBank?: BankProvider;
  bankName?: string;
  amount?: string;
  currency?: string;
  city?: string;
  rail?: string;
  userReference?: string;
  isStatic?: boolean;
  tags: Record<string, string>;
  subTags?: Record<string, Record<string, string>>;
}

/**
 * Parses Tag-Length-Value (TLV) string formatted according to EMVCo Merchant-Presented QR spec.
 */
export function parseTLV(payload: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;

  while (i < payload.length - 4) {
    const tag = payload.substring(i, i + 2);
    const lenStr = payload.substring(i + 2, i + 4);
    const length = parseInt(lenStr, 10);

    if (isNaN(length) || length < 0) {
      break;
    }

    const valueStart = i + 4;
    const valueEnd = valueStart + length;

    if (valueEnd > payload.length) {
      // Malformed or truncated
      result[tag] = payload.substring(valueStart);
      break;
    }

    result[tag] = payload.substring(valueStart, valueEnd);
    i = valueEnd;
  }

  return result;
}

/**
 * Parses full EMVCo QR Ph payload, extracting merchant details, bank provider, and account number.
 */
export function parseQRPhPayload(payload: string): ParsedEMVCo {
  if (!payload || typeof payload !== 'string') {
    return { isValid: false, isQRPh: false, tags: {} };
  }

  const trimmed = payload.trim();
  const tags = parseTLV(trimmed);

  // Check if it has EMVCo marker: Tag 00 is usually "01" (Payload Format Indicator)
  const isEMVCo = tags['00'] === '01';
  const isPH = tags['58']?.toUpperCase() === 'PH' || tags['53'] === '608'; // 608 is PHP currency code

  // If not strict EMVCo, try fallback matching for URLs or arbitrary text
  if (!isEMVCo && Object.keys(tags).length < 2) {
    return parseGenericPayload(trimmed);
  }

  const subTags: Record<string, Record<string, string>> = {};

  // Parse merchant account information templates (tags 26-51) and additional data (tag 62)
  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagKey = tagNum.toString().padStart(2, '0');
    if (tags[tagKey]) {
      subTags[tagKey] = parseTLV(tags[tagKey]);
    }
  }

  if (tags['62']) {
    subTags['62'] = parseTLV(tags['62']);
  }

  // 1. Merchant Name (Tag 59)
  const merchantName = tags['59'] ? tags['59'].trim() : undefined;

  // 2. City (Tag 60) - Clean trailing parentheses e.g. "New Clarin (Mi" -> "New Clarin"
  const rawCity = tags['60'] ? tags['60'].trim() : undefined;
  const city = rawCity ? rawCity.replace(/\s*\([^)]*$/, '').trim() : undefined;

  // 3. Amount & Currency
  const amount = tags['54'] ? tags['54'].trim() : undefined;
  const currency = tags['53'] === '608' ? 'PHP' : tags['53'];

  // 4. Point of initiation (11 = Static, 12 = Dynamic)
  const isStatic = tags['01'] === '11';

  // 5. Detect Rail (InstaPay vs Standard QR Ph)
  let rail = 'QR PH';
  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagKey = tagNum.toString().padStart(2, '0');
    const sub = subTags[tagKey];
    if (sub) {
      if (
        sub['00'] === 'com.p2pqrpay' ||
        sub['02'] === '99964403' ||
        Object.values(sub).some((v) => v.toLowerCase().includes('instapay'))
      ) {
        rail = 'INSTAPAY';
        break;
      }
    }
  }

  // 6. Detect User Reference (e.g. subtag 04 in Tag 27)
  let userReference: string | undefined;
  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagKey = tagNum.toString().padStart(2, '0');
    const sub = subTags[tagKey];
    if (sub && sub['04'] && sub['04'].length >= 4) {
      userReference = sub['04'];
      break;
    }
  }

  // 7. Detect Account Number / Mobile Number
  let accountNumber = extractAccountNumber(tags, subTags);

  // 8. Detect Bank Provider
  const detectedBank = detectBankProvider(trimmed, tags, subTags);

  return {
    isValid: true,
    isQRPh: isEMVCo && (isPH || !!detectedBank),
    merchantName,
    accountNumber,
    detectedBank,
    bankName: detectedBank ? BANK_CONFIGS[detectedBank].name : undefined,
    amount,
    currency,
    city,
    rail,
    userReference,
    isStatic,
    tags,
    subTags,
  };
}

/**
 * Searches tags and sub-tags for account or mobile number.
 */
function extractAccountNumber(
  _tags: Record<string, string>,
  subTags: Record<string, Record<string, string>>
): string | undefined {
  // 1. In P2P QR Ph (com.p2pqrpay), subtag 04 is the unique user proxy reference / account token (e.g. DWQM4TK3JDNXIB3FS)
  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagKey = tagNum.toString().padStart(2, '0');
    const sub = subTags[tagKey];
    if (sub && sub['04'] && sub['04'].length >= 4) {
      return sub['04'];
    }
  }

  // 2. Check merchant account info subtags (tags 26-51) for mobile or numeric account
  for (let tagNum = 26; tagNum <= 51; tagNum++) {
    const tagKey = tagNum.toString().padStart(2, '0');
    const sub = subTags[tagKey];
    if (sub) {
      for (const k of ['01', '02', '03']) {
        if (sub[k]) {
          const cleaned = cleanPotentialNumber(sub[k]);
          if (cleaned) return cleaned;
        }
      }
    }
  }

  // 3. Check Tag 62 (Additional Data Field)
  if (subTags['62']) {
    const s62 = subTags['62'];
    for (const k of ['02', '01', '05', '07']) {
      if (s62[k]) {
        const cleaned = cleanPotentialNumber(s62[k]);
        if (cleaned) return cleaned;
      }
    }
  }

  return undefined;
}

function cleanPotentialNumber(val: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();

  // Philippine mobile numbers (e.g., 09171234567, 639171234567, +639171234567)
  const mobileMatch = trimmed.match(/(?:\+63|63|0)9\d{9}/);
  if (mobileMatch) {
    let num = mobileMatch[0];
    if (num.startsWith('+63')) num = '0' + num.slice(3);
    else if (num.startsWith('63')) num = '0' + num.slice(2);
    return num;
  }

  // Skip known national clearing / participant routing codes and fixed settlement switch prefixes:
  // - 99964403: InstaPay Clearing Code
  // - 217020000000656 / 21702000...: GCash fixed P2P settlement bridge
  if (
    trimmed === '99964403' ||
    trimmed === '217020000000656' ||
    trimmed.startsWith('217020000000')
  ) {
    return undefined;
  }

  // Generic bank account numbers (8-16 digits)
  const bankAcctMatch = trimmed.match(/\b\d{8,16}\b/);
  if (bankAcctMatch) {
    return bankAcctMatch[0];
  }

  return undefined;
}

/**
 * Detects the Philippine bank / e-wallet provider by scanning reverse domain identifiers,
 * merchant account sub-tags, and raw payload text.
 */
export function detectBankProvider(
  rawPayload: string,
  _tags?: Record<string, string>,
  subTags?: Record<string, Record<string, string>>
): BankProvider | undefined {
  const lowerPayload = rawPayload.toLowerCase();

  // 1. Check known reverse domains and identifiers inside merchant account blocks
  const searchableParts: string[] = [lowerPayload];

  if (subTags) {
    for (const key of Object.keys(subTags)) {
      const sub = subTags[key];
      for (const subKey of Object.keys(sub)) {
        searchableParts.push(sub[subKey].toLowerCase());
      }
    }
  }

  const combinedSearch = searchableParts.join(' ');

  for (const [providerKey, config] of Object.entries(BANK_CONFIGS)) {
    if (providerKey === 'other') continue;
    for (const ident of config.identifiers) {
      if (combinedSearch.includes(ident.toLowerCase())) {
        return providerKey as BankProvider;
      }
    }
  }

  // Fallback checks
  if (combinedSearch.includes('gcash') || combinedSearch.includes('gxch')) return 'gcash';
  if (combinedSearch.includes('maya') || combinedSearch.includes('paym')) return 'maya';
  if (combinedSearch.includes('rcbc') || combinedSearch.includes('pulz')) return 'rcbc';
  if (combinedSearch.includes('bpi') || combinedSearch.includes('bopi')) return 'bpi';
  if (combinedSearch.includes('unionbank') || combinedSearch.includes('ubph') || combinedSearch.includes('ubp')) return 'unionbank';
  if (combinedSearch.includes('bdo') || combinedSearch.includes('bnor')) return 'bdo';
  if (combinedSearch.includes('gotyme') || combinedSearch.includes('tyme')) return 'gotyme';
  if (combinedSearch.includes('seabank') || combinedSearch.includes('seab') || combinedSearch.includes('shopeepay')) return 'seabank';
  if (combinedSearch.includes('metrobank') || combinedSearch.includes('mbtc')) return 'metrobank';
  if (combinedSearch.includes('cimb') || combinedSearch.includes('ciba')) return 'cimb';

  return undefined;
}

/**
 * Fallback parser for non-EMVCo payload (e.g. plain URL or text).
 */
function parseGenericPayload(raw: string): ParsedEMVCo {
  const detected = detectBankProvider(raw, {}, {});
  const mobile = cleanPotentialNumber(raw);

  return {
    isValid: true,
    isQRPh: false,
    merchantName: undefined,
    accountNumber: mobile,
    detectedBank: detected,
    bankName: detected ? BANK_CONFIGS[detected].name : undefined,
    tags: {},
  };
}

/**
 * Format Philippine mobile number, bank account number, or User ID proxy for display.
 * e.g., "09171234567" -> "0917 123 4567"
 * or "DWQM4TK3JDNXIB3FS" -> "ID: ••••XIB3FS" (masked) or "ID: DWQM4TK3JDNXIB3FS"
 */
export function formatAccountNumber(number: string, mask = false): string {
  if (!number) return '';
  const trimmed = number.trim();

  // If it's an alphanumeric reference/token (e.g. DWQM4TK3JDNXIB3FS)
  if (/[a-zA-Z]/.test(trimmed)) {
    if (mask) {
      if (trimmed.length > 6) {
        return `ID: ••••${trimmed.slice(-4)}`;
      }
      return 'ID: ••••';
    }
    return trimmed.startsWith('ID:') ? trimmed : `ID: ${trimmed}`;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (mask) {
    if (digits.length === 11 && digits.startsWith('09')) {
      // 0917 •••• 5678
      return `${digits.slice(0, 4)} •••• ${digits.slice(-4)}`;
    }
    if (digits.length >= 8) {
      // 1234 •••• 5678
      const prefixLen = Math.min(4, Math.floor(digits.length / 3));
      const suffixLen = Math.min(4, Math.floor(digits.length / 3));
      return `${digits.slice(0, prefixLen)} •••• ${digits.slice(-suffixLen)}`;
    }
    if (digits.length >= 4) {
      return `•••• ${digits.slice(-4)}`;
    }
    return '••••';
  }

  // Philippine 11-digit mobile: 09XX XXX XXXX
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // 12-digit account (RCBC, BDO, etc.): XXXX XXXX XXXX
  if (digits.length === 12) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }

  // 10-digit account (BPI, etc.): XXXX XXX XXX
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // Chunk by 4s
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim() || number;
}
