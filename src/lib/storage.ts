import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { QRCardItem } from '../types/qr';

interface PocketQRDB extends DBSchema {
  cards: {
    key: string;
    value: QRCardItem;
    indexes: {
      'by_favorite': number;
      'by_order': number;
      'by_bank': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'pocketqr_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PocketQRDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PocketQRDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PocketQRDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('by_favorite', 'isFavorite');
          cardStore.createIndex('by_order', 'orderIndex');
          cardStore.createIndex('by_bank', 'bank');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Retrieves all saved QR cards, ordered with favorites first, then by orderIndex/createdAt.
 */
export async function getAllCards(): Promise<QRCardItem[]> {
  const db = await getDB();
  const cards = await db.getAll('cards');

  return cards.sort((a, b) => {
    // Favorites first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    // Then orderIndex
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    // Then newest first
    return b.createdAt - a.createdAt;
  });
}

/**
 * Saves or updates a card in IndexedDB.
 */
export async function saveCard(card: QRCardItem): Promise<void> {
  const db = await getDB();
  await db.put('cards', card);
}

/**
 * Deletes a card by ID.
 */
export async function deleteCard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('cards', id);
}

/**
 * Toggles the favorite status of a card.
 */
export async function toggleFavorite(id: string): Promise<QRCardItem | undefined> {
  const db = await getDB();
  const card = await db.get('cards', id);
  if (card) {
    card.isFavorite = !card.isFavorite;
    card.updatedAt = Date.now();
    await db.put('cards', card);
    return card;
  }
  return undefined;
}

/**
 * Reorders cards in IndexedDB.
 */
export async function saveCardOrder(cards: QRCardItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  for (let i = 0; i < cards.length; i++) {
    const card = { ...cards[i], orderIndex: i, updatedAt: Date.now() };
    await tx.store.put(card);
  }
  await tx.done;
}

/**
 * Export the entire wallet as a downloadable JSON string.
 */
export async function exportBackup(): Promise<string> {
  const cards = await getAllCards();
  const backupData = {
    app: 'PocketQR',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    cardCount: cards.length,
    cards,
  };
  return JSON.stringify(backupData, null, 2);
}

/**
 * Restores a wallet from a JSON backup string.
 */
export async function importBackup(
  jsonString: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.cards)) {
      return { success: false, count: 0, error: 'Invalid PocketQR backup format' };
    }

    const db = await getDB();
    const tx = db.transaction('cards', 'readwrite');
    let imported = 0;

    for (const card of parsed.cards) {
      if (card && card.id && card.accountName && card.bank) {
        await tx.store.put({
          ...card,
          updatedAt: Date.now(),
        });
        imported++;
      }
    }

    await tx.done;
    return { success: true, count: imported };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown JSON parse error';
    return { success: false, count: 0, error: msg };
  }
}

/**
 * Helper to build an inline placeholder SVG image for sample cards.
 */
function createSampleSvgDataUrl(title: string, color: string, sub: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#ffffff" rx="16"/>
    <rect x="20" y="20" width="360" height="360" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="8 4" rx="12"/>
    <rect x="40" y="40" width="80" height="80" fill="${color}" rx="8"/>
    <rect x="55" y="55" width="50" height="50" fill="#ffffff" rx="4"/>
    <rect x="68" y="68" width="24" height="24" fill="${color}"/>
    <rect x="280" y="40" width="80" height="80" fill="${color}" rx="8"/>
    <rect x="295" y="55" width="50" height="50" fill="#ffffff" rx="4"/>
    <rect x="308" y="68" width="24" height="24" fill="${color}"/>
    <rect x="40" y="280" width="80" height="80" fill="${color}" rx="8"/>
    <rect x="55" y="295" width="50" height="50" fill="#ffffff" rx="4"/>
    <rect x="68" y="308" width="24" height="24" fill="${color}"/>
    <text x="200" y="195" font-family="sans-serif" font-weight="bold" font-size="22" fill="#0f172a" text-anchor="middle">QR Ph</text>
    <text x="200" y="225" font-family="sans-serif" font-weight="600" font-size="16" fill="${color}" text-anchor="middle">${title}</text>
    <text x="200" y="250" font-family="sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_CARDS: QRCardItem[] = [
  {
    id: 'sample-gcash-01',
    bank: 'gcash',
    accountName: 'Nick Vincent G.',
    accountNumber: '09175551234',
    category: 'personal',
    notes: 'Personal GCash QR Ph for quick peer transfers & dining',
    rawPayload: '00020101021126310012ph.com.gcash0111091755512345204601653036085802PH5914NICK VINCENT G6006TAGUIG62150211091755512346304ABCD',
    imageDataUrl: createSampleSvgDataUrl('GCash Personal', '#005CE6', '0917 •••• 1234'),
    isFavorite: true,
    orderIndex: 0,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'sample-maya-02',
    bank: 'maya',
    accountName: 'N. Gultiano Services',
    accountNumber: '09985554567',
    category: 'business',
    notes: 'Maya Business QR Ph for freelance clients & invoice settlements',
    rawPayload: '00020101021126260007ph.maya0111099855545675204601653036085802PH5919N GULTIANO SERVICES6006MANILA621502110998555456763041234',
    imageDataUrl: createSampleSvgDataUrl('Maya Business', '#00D66F', '0998 •••• 4567'),
    isFavorite: true,
    orderIndex: 1,
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'sample-rcbc-03',
    bank: 'rcbc',
    accountName: 'Nick Vincent Gultiano',
    accountNumber: '100988887890',
    category: 'savings',
    notes: 'RCBC Pulz Savings Account - InstaPay / PesoNet QR Ph',
    rawPayload: '00020101021126310011ph.com.rcbc01121009888878905204601653036085802PH5915NICK V GULTIANO6006MAKATI6216011210098888789063045678',
    imageDataUrl: createSampleSvgDataUrl('RCBC Pulz Savings', '#0A3180', '1009 •••• 7890'),
    isFavorite: false,
    orderIndex: 2,
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now() - 3600000 * 6,
  },
];

/**
 * Seeds default sample cards if the database is currently empty.
 */
export async function seedDefaultCardsIfEmpty(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('cards');
  if (count === 0) {
    const tx = db.transaction('cards', 'readwrite');
    for (const card of SAMPLE_CARDS) {
      await tx.store.put(card);
    }
    await tx.done;
    return true;
  }
  return false;
}

/**
 * Resets database back to default sample cards.
 */
export async function resetToSampleCards(): Promise<void> {
  const db = await getDB();
  await db.clear('cards');
  const tx = db.transaction('cards', 'readwrite');
  for (const card of SAMPLE_CARDS) {
    await tx.store.put(card);
  }
  await tx.done;
}

/**
 * Clears all cards from database (Zero-Fill purge).
 */
export async function clearAllCards(): Promise<void> {
  const db = await getDB();
  await db.clear('cards');
}

/**
 * Settings helpers: Get/Set security preferences (privacy masking, PIN).
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const val = await db.get('settings', key);
  return val !== undefined ? val : defaultValue;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}
