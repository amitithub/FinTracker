import { describe, expect, it } from 'vitest';
import {
  isValidCadence,
  isValidCalendarDate,
  isValidCategory,
  isValidCurrency,
  isValidEmail,
  isValidId,
  sanitizeText,
  validateBudgetInput,
  validateExpenseInput,
  validatePassword,
  validateRecurringInput,
} from '../lib/validation';

describe('validation utilities', () => {
  it('sanitizes control characters and enforces maxLength', () => {
    const dirty = '  Coffee\u0000Shop\u0007  ';
    expect(sanitizeText(dirty, 50)).toBe('CoffeeShop');
    expect(sanitizeText('abcdef', 3)).toBe('abc');
  });

  it('validates Firestore document IDs safely', () => {
    expect(isValidId('exp_123-abc')).toBe(true);
    expect(isValidId('')).toBe(false);
    expect(isValidId('bad/id')).toBe(false);
    expect(isValidId('a'.repeat(129))).toBe(false);
  });

  it('validates enums and calendar dates including leap years', () => {
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('BTC')).toBe(false);
    expect(isValidCategory('Food & Dining')).toBe(true);
    expect(isValidCategory('Crypto')).toBe(false);
    expect(isValidCadence('monthly')).toBe(true);
    expect(isValidCadence('daily')).toBe(false);
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('2025-02-29')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });

  it('validates and computes convertedAmount on expense input', () => {
    const ok = validateExpenseInput({
      title: '  Train Ticket ',
      amount: '100',
      currency: 'EUR',
      exchangeRate: '1.1',
      category: 'Travel',
      date: '2026-11-10',
      notes: 'Paris trip',
    });
    expect(ok.valid).toBe(true);
    expect(ok.sanitized?.title).toBe('Train Ticket');
    expect(ok.sanitized?.convertedAmount).toBe(110);
    expect(ok.sanitized?.monthKey).toBe('2026-11');

    const bad = validateExpenseInput({
      title: '',
      amount: -10,
      currency: 'XYZ',
      exchangeRate: 0,
      category: 'Travel',
      date: '2026-02-30',
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.title).toBeDefined();
    expect(bad.errors.amount).toBeDefined();
    expect(bad.errors.currency).toBeDefined();
    expect(bad.errors.exchangeRate).toBeDefined();
    expect(bad.errors.date).toBeDefined();
  });

  it('validates budget and recurring bill inputs', () => {
    const bgt = validateBudgetInput({
      category: 'Housing',
      monthlyLimit: '1800',
      alertThresholdPercent: '85',
    });
    expect(bgt.valid).toBe(true);
    expect(bgt.sanitized?.monthlyLimit).toBe(1800);

    const badBgt = validateBudgetInput({
      category: 'Housing',
      monthlyLimit: 0,
      alertThresholdPercent: 5,
    });
    expect(badBgt.valid).toBe(false);

    const rec = validateRecurringInput({
      title: 'Fiber Internet',
      amount: 65,
      currency: 'USD',
      category: 'Utilities',
      cadence: 'monthly',
      nextDueDate: '2026-12-01',
    });
    expect(rec.valid).toBe(true);
    expect(rec.sanitized?.autoRemind).toBe(true);
  });

  it('validates email and password rules', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('bad-email')).toBe(false);
    expect(validatePassword('short')).not.toBeNull();
    expect(validatePassword('validPass123')).toBeNull();
  });
});
