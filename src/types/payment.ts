import type { BankProvider } from './qr';

export interface PayingBankApp {
  id: BankProvider;
  name: string;
  shortName: string;
  scheme: string;
  androidPackage: string;
  iosScheme: string;
  playStoreUrl: string;
  appStoreUrl: string;
  gradient: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
}

export const PAYING_BANK_APPS: PayingBankApp[] = [
  {
    id: 'gcash',
    name: 'GCash',
    shortName: 'GCash',
    scheme: 'gcash://',
    androidPackage: 'com.globe.gcash.android',
    iosScheme: 'gcash://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.globe.gcash.android',
    appStoreUrl: 'https://apps.apple.com/ph/app/gcash/id520364958',
    gradient: 'from-[#005CE6] via-[#0047b3] to-[#002b80]',
    accentColor: '#2A7FFF',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    borderAccent: 'border-blue-400/40',
  },
  {
    id: 'maya',
    name: 'Maya',
    shortName: 'Maya',
    scheme: 'maya://',
    androidPackage: 'com.paymaya',
    iosScheme: 'paymaya://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.paymaya',
    appStoreUrl: 'https://apps.apple.com/ph/app/maya-credit-savings-wallet/id991808453',
    gradient: 'from-[#042f1a] via-[#064E3B] to-[#011409]',
    accentColor: '#00D66F',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    borderAccent: 'border-emerald-500/40',
  },
  {
    id: 'rcbc',
    name: 'RCBC Pulz',
    shortName: 'RCBC Pulz',
    scheme: 'rcbc://',
    androidPackage: 'com.rcbc.pulz',
    iosScheme: 'pulz://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.rcbc.pulz',
    appStoreUrl: 'https://apps.apple.com/ph/app/rcbc-pulz/id1641320491',
    gradient: 'from-[#0A3180] via-[#072159] to-[#001438]',
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    borderAccent: 'border-amber-400/40',
  },
  {
    id: 'bpi',
    name: 'BPI',
    shortName: 'BPI',
    scheme: 'bpi://',
    androidPackage: 'com.bpi.ng.app',
    iosScheme: 'bpi://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bpi.ng.app',
    appStoreUrl: 'https://apps.apple.com/ph/app/bpi/id1552309193',
    gradient: 'from-[#8B0000] via-[#5C0000] to-[#2B0000]',
    accentColor: '#F59E0B',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    borderAccent: 'border-red-400/40',
  },
  {
    id: 'unionbank',
    name: 'UnionBank Online',
    shortName: 'UnionBank',
    scheme: 'unionbank://',
    androidPackage: 'com.unionbankph.online',
    iosScheme: 'ubp://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.unionbankph.online',
    appStoreUrl: 'https://apps.apple.com/ph/app/unionbank-online/id1273946271',
    gradient: 'from-[#EA580C] via-[#9A3412] to-[#431407]',
    accentColor: '#FDBA74',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    borderAccent: 'border-orange-400/40',
  },
  {
    id: 'bdo',
    name: 'BDO Pay',
    shortName: 'BDO Pay',
    scheme: 'bdopay://',
    androidPackage: 'com.bdo.pay',
    iosScheme: 'bdopay://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bdo.pay',
    appStoreUrl: 'https://apps.apple.com/ph/app/bdo-pay/id1527011985',
    gradient: 'from-[#003366] via-[#001F3F] to-[#000F20]',
    accentColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20',
    badgeText: 'text-yellow-300',
    borderAccent: 'border-yellow-400/40',
  },
  {
    id: 'gotyme',
    name: 'GoTyme Bank',
    shortName: 'GoTyme',
    scheme: 'gotyme://',
    androidPackage: 'com.tyme.gotyme',
    iosScheme: 'gotyme://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.tyme.gotyme',
    appStoreUrl: 'https://apps.apple.com/ph/app/gotyme-bank/id1626027818',
    gradient: 'from-[#0D9488] via-[#115E59] to-[#042F2E]',
    accentColor: '#5EEAD4',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    borderAccent: 'border-teal-400/40',
  },
  {
    id: 'seabank',
    name: 'SeaBank',
    shortName: 'SeaBank',
    scheme: 'seabank://',
    androidPackage: 'com.seabank.ph',
    iosScheme: 'seabank://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.seabank.ph',
    appStoreUrl: 'https://apps.apple.com/ph/app/seabank-ph/id1584739579',
    gradient: 'from-[#FF5722] via-[#E64A19] to-[#BF360C]',
    accentColor: '#FFCCBC',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-200',
    borderAccent: 'border-orange-400/40',
  },
];
