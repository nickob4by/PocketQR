export type BankProvider =
  | 'gcash'
  | 'maya'
  | 'rcbc'
  | 'bpi'
  | 'unionbank'
  | 'bdo'
  | 'gotyme'
  | 'seabank'
  | 'metrobank'
  | 'cimb'
  | 'other';

export type AccountCategory = 'personal' | 'business' | 'savings' | 'bill-split' | 'other';

export interface QRCardItem {
  id: string;
  bank: BankProvider;
  bankCustomName?: string;
  accountName: string;
  accountNumber: string;
  category: AccountCategory;
  notes?: string;
  rawPayload?: string;      // Decoded EMVCo QR Ph payload (e.g. 000201010211...)
  imageDataUrl: string;     // Base64 data URL of screenshot or cropped QR
  isFavorite: boolean;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
  city?: string;
  rail?: string;
}

export interface BankConfig {
  id: BankProvider;
  name: string;
  shortName: string;
  gradient: string;
  cardBg: string;
  glowClass: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  defaultCategory: AccountCategory;
  identifiers: string[]; // Keywords to match from EMVCo payload or raw text
}

export const BANK_CONFIGS: Record<BankProvider, BankConfig> = {
  gcash: {
    id: 'gcash',
    name: 'GCash',
    shortName: 'GCash',
    gradient: 'from-[#005CE6] via-[#0047b3] to-[#002b80]',
    cardBg: '#003B99',
    glowClass: 'shadow-glow-gcash',
    accentColor: '#2A7FFF',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    borderAccent: 'border-blue-400/30',
    defaultCategory: 'personal',
    identifiers: ['gcash', 'gxch', 'gxchange', 'g-xchange', 'mynt', 'ph.com.gcash'],
  },
  maya: {
    id: 'maya',
    name: 'Maya',
    shortName: 'Maya',
    gradient: 'from-[#042f1a] via-[#064E3B] to-[#011409]',
    cardBg: '#052E16',
    glowClass: 'shadow-glow-maya',
    accentColor: '#00D66F',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    borderAccent: 'border-emerald-500/40',
    defaultCategory: 'personal',
    identifiers: ['maya', 'paym', 'paymaya', 'voyager', 'ph.maya', 'ph.com.paymaya'],
  },
  rcbc: {
    id: 'rcbc',
    name: 'RCBC Pulz',
    shortName: 'RCBC',
    gradient: 'from-[#0A3180] via-[#072159] to-[#001438]',
    cardBg: '#00205B',
    glowClass: 'shadow-glow-rcbc',
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    borderAccent: 'border-amber-400/30',
    defaultCategory: 'savings',
    identifiers: ['rcbc', 'pulz', 'rizal commercial', 'ph.com.rcbc'],
  },
  bpi: {
    id: 'bpi',
    name: 'BPI',
    shortName: 'BPI',
    gradient: 'from-[#8B0000] via-[#5C0000] to-[#2B0000]',
    cardBg: '#5C0000',
    glowClass: 'shadow-red-900/40',
    accentColor: '#F59E0B',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    borderAccent: 'border-red-400/30',
    defaultCategory: 'savings',
    identifiers: ['bpi', 'bopi', 'bank of the philippine islands', 'ph.com.bpi'],
  },
  unionbank: {
    id: 'unionbank',
    name: 'UnionBank',
    shortName: 'UBP',
    gradient: 'from-[#EA580C] via-[#9A3412] to-[#431407]',
    cardBg: '#9A3412',
    glowClass: 'shadow-orange-900/40',
    accentColor: '#FDBA74',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    borderAccent: 'border-orange-400/30',
    defaultCategory: 'savings',
    identifiers: ['unionbank', 'ubph', 'ubp', 'ph.com.unionbankph'],
  },
  bdo: {
    id: 'bdo',
    name: 'BDO Unibank',
    shortName: 'BDO',
    gradient: 'from-[#003366] via-[#001F3F] to-[#000F20]',
    cardBg: '#001F3F',
    glowClass: 'shadow-blue-950/50',
    accentColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20',
    badgeText: 'text-yellow-300',
    borderAccent: 'border-yellow-400/30',
    defaultCategory: 'savings',
    identifiers: ['bdo', 'bnor', 'bdo unibank', 'bdo network', 'ph.com.bdo'],
  },
  gotyme: {
    id: 'gotyme',
    name: 'GoTyme Bank',
    shortName: 'GoTyme',
    gradient: 'from-[#0D9488] via-[#115E59] to-[#042F2E]',
    cardBg: '#115E59',
    glowClass: 'shadow-teal-900/40',
    accentColor: '#5EEAD4',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    borderAccent: 'border-teal-400/30',
    defaultCategory: 'personal',
    identifiers: ['gotyme', 'tyme', 'ph.com.gotyme'],
  },
  seabank: {
    id: 'seabank',
    name: 'SeaBank / ShopeePay',
    shortName: 'SeaBank',
    gradient: 'from-[#FF5722] via-[#E64A19] to-[#BF360C]',
    cardBg: '#E64A19',
    glowClass: 'shadow-orange-800/40',
    accentColor: '#FFCCBC',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-200',
    borderAccent: 'border-orange-400/30',
    defaultCategory: 'personal',
    identifiers: ['seabank', 'seab', 'shopee', 'shopeepay', 'searoc'],
  },
  metrobank: {
    id: 'metrobank',
    name: 'Metrobank',
    shortName: 'MBTC',
    gradient: 'from-[#1E3A8A] via-[#172554] to-[#0A0F1D]',
    cardBg: '#172554',
    glowClass: 'shadow-blue-900/40',
    accentColor: '#60A5FA',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    borderAccent: 'border-blue-400/30',
    defaultCategory: 'savings',
    identifiers: ['metrobank', 'mbtc', 'metropolitan bank'],
  },
  cimb: {
    id: 'cimb',
    name: 'CIMB Bank',
    shortName: 'CIMB',
    gradient: 'from-[#7F1D1D] via-[#450A0A] to-[#1C0000]',
    cardBg: '#450A0A',
    glowClass: 'shadow-red-950/40',
    accentColor: '#F87171',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    borderAccent: 'border-red-400/30',
    defaultCategory: 'savings',
    identifiers: ['cimb', 'cimb bank'],
  },
  other: {
    id: 'other',
    name: 'Other Bank / Wallet',
    shortName: 'QR Ph',
    gradient: 'from-[#334155] via-[#1E293B] to-[#0F172A]',
    cardBg: '#1E293B',
    glowClass: 'shadow-slate-800/40',
    accentColor: '#94A3B8',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-300',
    borderAccent: 'border-slate-500/30',
    defaultCategory: 'personal',
    identifiers: ['qr ph', 'ppmi', 'bsp', 'instapay', 'pesonet'],
  },
};

export type LogActionType =
  | 'dispatch_payment'
  | 'saved_photo'
  | 'copied_details'
  | 'card_added'
  | 'card_updated'
  | 'card_deleted';

export interface ActivityLogItem {
  id: string;
  type: LogActionType;
  timestamp: number;
  title: string;              // Payee, Card name, or Merchant
  bank?: string;              // e.g. GCash, Maya, BPI
  rail?: string;              // e.g. InstaPay, QR Ph
  targetApp?: string;         // e.g. "GCash", "Maya" (for dispatched payments)
  accountNumber?: string;
  rawPayload?: string;        // Allows 1-tap re-paying
  detail?: string;            // Contextual description
}

