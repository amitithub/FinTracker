import {
  BillCadence,
  CADENCES,
  CATEGORIES,
  CURRENCIES,
  CurrencyCode,
  DATE_PATTERN,
  ExpenseCategory,
  ID_PATTERN,
  MAX_AMOUNT,
  MAX_EXCHANGE_RATE,
  MAX_ID_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
} from '../types/expense';

export interface ValidationResult<T> {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: T;
}

export function sanitizeText(value: string, maxLength: number): string {
  // Strip ASCII control characters except standard space, trim, and bound length
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

export function isValidId(value: string): boolean {
  return typeof value === 'string' && value.length >= 1 && value.length <= MAX_ID_LENGTH && ID_PATTERN.test(value);
}

export function isValidCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function isValidCategory(value: string): value is ExpenseCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isValidCadence(value: string): value is BillCadence {
  return (CADENCES as readonly string[]).includes(value);
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_PATTERN.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export interface ExpenseDraftInput {
  title: string;
  amount: number | string;
  currency: string;
  exchangeRate: number | string;
  category: string;
  date: string;
  notes?: string;
  recurringId?: string;
}

export interface SanitizedExpenseInput {
  title: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number;
  convertedAmount: number;
  category: ExpenseCategory;
  date: string;
  monthKey: string;
  notes: string;
  recurringId?: string;
}

export function validateExpenseInput(input: ExpenseDraftInput): ValidationResult<SanitizedExpenseInput> {
  const errors: Record<string, string> = {};
  const title = sanitizeText(input.title || '', MAX_TITLE_LENGTH);
  const notes = sanitizeText(input.notes || '', MAX_NOTES_LENGTH);
  const amount = typeof input.amount === 'string' ? Number(input.amount) : input.amount;
  const exchangeRate = typeof input.exchangeRate === 'string' ? Number(input.exchangeRate) : input.exchangeRate;

  if (!title) {
    errors.title = 'Enter a short description or merchant name.';
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    errors.amount = 'Enter a valid amount greater than 0.';
  }
  if (!isValidCurrency(input.currency)) {
    errors.currency = 'Select a supported currency.';
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate > MAX_EXCHANGE_RATE) {
    errors.exchangeRate = 'Exchange rate must be greater than 0.';
  }
  if (!isValidCategory(input.category)) {
    errors.category = 'Select a valid category.';
  }
  if (!isValidCalendarDate(input.date)) {
    errors.date = 'Choose a valid calendar date.';
  }

  const convertedAmount =
    Number.isFinite(amount) && Number.isFinite(exchangeRate)
      ? Math.round(amount * exchangeRate * 100) / 100
      : 0;

  if (Number.isFinite(convertedAmount) && convertedAmount <= 0 && !errors.amount && !errors.exchangeRate) {
    errors.amount = 'Converted amount must be at least 0.01 in base currency.';
  }

  let cleanRecurringId: string | undefined;
  if (input.recurringId) {
    const trimmedId = input.recurringId.trim();
    if (!isValidId(trimmedId)) {
      errors.recurringId = 'Invalid recurring reference ID.';
    } else {
      cleanRecurringId = trimmedId;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      title,
      amount: Math.round(amount * 100) / 100,
      currency: input.currency as CurrencyCode,
      exchangeRate: Math.round(exchangeRate * 1_000_000) / 1_000_000,
      convertedAmount,
      category: input.category as ExpenseCategory,
      date: input.date,
      monthKey: input.date.slice(0, 7),
      notes,
      ...(cleanRecurringId ? { recurringId: cleanRecurringId } : {}),
    },
  };
}

export interface BudgetDraftInput {
  category: string;
  monthlyLimit: number | string;
  alertThresholdPercent?: number | string;
}

export interface SanitizedBudgetInput {
  category: ExpenseCategory;
  monthlyLimit: number;
  alertThresholdPercent: number;
}

export function validateBudgetInput(input: BudgetDraftInput): ValidationResult<SanitizedBudgetInput> {
  const errors: Record<string, string> = {};
  const monthlyLimit = typeof input.monthlyLimit === 'string' ? Number(input.monthlyLimit) : input.monthlyLimit;
  const threshold =
    input.alertThresholdPercent === undefined
      ? 80
      : typeof input.alertThresholdPercent === 'string'
        ? Number(input.alertThresholdPercent)
        : input.alertThresholdPercent;

  if (!isValidCategory(input.category)) {
    errors.category = 'Select a valid category.';
  }
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0 || monthlyLimit > MAX_AMOUNT) {
    errors.monthlyLimit = 'Monthly limit must be greater than 0.';
  }
  if (!Number.isFinite(threshold) || threshold < 10 || threshold > 100) {
    errors.alertThresholdPercent = 'Alert threshold must be between 10% and 100%.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      category: input.category as ExpenseCategory,
      monthlyLimit: Math.round(monthlyLimit * 100) / 100,
      alertThresholdPercent: Math.round(threshold),
    },
  };
}

export interface RecurringDraftInput {
  title: string;
  amount: number | string;
  currency: string;
  category: string;
  cadence: string;
  nextDueDate: string;
  autoRemind?: boolean;
  lastPaidDate?: string;
}

export interface SanitizedRecurringInput {
  title: string;
  amount: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  cadence: BillCadence;
  nextDueDate: string;
  autoRemind: boolean;
  lastPaidDate: string;
}

export function validateRecurringInput(input: RecurringDraftInput): ValidationResult<SanitizedRecurringInput> {
  const errors: Record<string, string> = {};
  const title = sanitizeText(input.title || '', MAX_TITLE_LENGTH);
  const amount = typeof input.amount === 'string' ? Number(input.amount) : input.amount;

  if (!title) {
    errors.title = 'Enter a recurring bill name.';
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    errors.amount = 'Enter a valid amount greater than 0.';
  }
  if (!isValidCurrency(input.currency)) {
    errors.currency = 'Select a supported currency.';
  }
  if (!isValidCategory(input.category)) {
    errors.category = 'Select a valid category.';
  }
  if (!isValidCadence(input.cadence)) {
    errors.cadence = 'Choose weekly, monthly, or yearly.';
  }
  if (!isValidCalendarDate(input.nextDueDate)) {
    errors.nextDueDate = 'Choose a valid next due date.';
  }

  const lastPaidDate = input.lastPaidDate ? input.lastPaidDate.trim() : '';
  if (lastPaidDate !== '' && !isValidCalendarDate(lastPaidDate)) {
    errors.lastPaidDate = 'Invalid last paid date.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      title,
      amount: Math.round(amount * 100) / 100,
      currency: input.currency as CurrencyCode,
      category: input.category as ExpenseCategory,
      cadence: input.cadence as BillCadence,
      nextDueDate: input.nextDueDate,
      autoRemind: Boolean(input.autoRemind ?? true),
      lastPaidDate,
    },
  };
}

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length >= 3 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  return null;
}
