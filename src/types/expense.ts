export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
  'CHF',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<CurrencyCode, { name: string; symbol: string; decimals: number }> = {
  USD: { name: 'US Dollar', symbol: '$', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  GBP: { name: 'British Pound', symbol: '£', decimals: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
};

export const CATEGORIES = [
  'Housing',
  'Food & Dining',
  'Transport',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Travel',
  'Software & Subscriptions',
  'Other',
] as const;

export type ExpenseCategory = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Housing: '#2563EB',
  'Food & Dining': '#0D9488',
  Transport: '#D97706',
  Utilities: '#6366F1',
  Healthcare: '#E11D48',
  Shopping: '#8B5CF6',
  Entertainment: '#EC4899',
  Travel: '#0284C7',
  'Software & Subscriptions': '#16A34A',
  Other: '#64748B',
};

export const CADENCES = ['weekly', 'monthly', 'yearly'] as const;
export type BillCadence = (typeof CADENCES)[number];

export type ThemePreference = 'light' | 'dark' | 'system';

// Blueprint-synchronized validation constants
export const MAX_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTES_LENGTH = 500;
export const MAX_AMOUNT = 100_000_000;
export const MAX_EXCHANGE_RATE = 1_000_000;
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export interface UserPreferences {
  ownerId: string;
  baseCurrency: CurrencyCode;
  monthlyBudgetLimit: number;
  themePreference: ThemePreference;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  convertedAmount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  notes: string;
  recurringId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryBudget {
  id: string;
  ownerId: string;
  category: ExpenseCategory;
  monthlyLimit: number;
  alertThresholdPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurringBill {
  id: string;
  ownerId: string;
  title: string;
  amount: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  cadence: BillCadence;
  nextDueDate: string; // YYYY-MM-DD
  autoRemind: boolean;
  lastPaidDate: string; // '' or YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
}

export type BudgetHealthStatus = 'on_track' | 'approaching' | 'exceeded';

export interface BudgetEvaluation {
  id: string;
  category: ExpenseCategory | 'Overall';
  spent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  alertThresholdPercent: number;
  status: BudgetHealthStatus;
  statusLabel: string;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  total: number;
  count: number;
}

export interface CategoryBreakdownItem {
  category: ExpenseCategory;
  total: number;
  count: number;
  percentage: number;
  color: string;
}
