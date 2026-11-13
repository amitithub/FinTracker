import { describe, expect, it, vi } from 'vitest';
import {
  buildRatesForBase,
  convertCurrency,
  FALLBACK_USD_RATES,
  fetchLiveRates,
  formatCurrency,
  getExchangeRate,
} from '../lib/currency';

describe('currency utilities', () => {
  it('builds consistent base rates where base currency equals 1', () => {
    const eurRates = buildRatesForBase('EUR', FALLBACK_USD_RATES);
    expect(eurRates.EUR).toBe(1);
    expect(eurRates.USD).toBeGreaterThan(1);

    const inrRates = buildRatesForBase('INR', FALLBACK_USD_RATES);
    expect(inrRates.INR).toBe(1);
    expect(inrRates.USD).toBeLessThan(1);
  });

  it('computes cross-currency exchange rate and converts amounts accurately', () => {
    const usdRates = buildRatesForBase('USD', FALLBACK_USD_RATES);
    expect(getExchangeRate('USD', 'USD', usdRates, 'USD')).toBe(1);

    const eurToUsd = convertCurrency(100, 'EUR', 'USD', usdRates, 'USD');
    expect(eurToUsd.exchangeRate).toBeCloseTo(1 / FALLBACK_USD_RATES.EUR, 3);
    expect(eurToUsd.convertedAmount).toBeCloseTo(108.7, 1);

    const inrRates = buildRatesForBase('INR', FALLBACK_USD_RATES);
    const usdToInr = convertCurrency(10, 'USD', 'INR', inrRates, 'INR');
    expect(usdToInr.convertedAmount).toBeCloseTo(844, 0);
  });

  it('handles zero-decimal currencies like JPY cleanly', () => {
    const usdRates = buildRatesForBase('USD', FALLBACK_USD_RATES);
    const usdToJpy = convertCurrency(10, 'USD', 'JPY', usdRates, 'USD');
    expect(Number.isInteger(usdToJpy.convertedAmount)).toBe(true);
    expect(formatCurrency(1535, 'JPY')).toContain('1,535');
    expect(formatCurrency(42.5, 'USD')).toBe('$42.50');
    expect(formatCurrency(26000, 'INR')).toContain('26,000');
  });

  it('returns zero safely for invalid or negative inputs and falls back when FX API fails', async () => {
    const usdRates = buildRatesForBase('USD', FALLBACK_USD_RATES);
    expect(convertCurrency(-5, 'USD', 'EUR', usdRates, 'USD').convertedAmount).toBe(0);
    expect(convertCurrency(Number.NaN, 'USD', 'EUR', usdRates, 'USD').convertedAmount).toBe(0);

    localStorage.clear();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const res = await fetchLiveRates('INR');
    expect(res.base).toBe('INR');
    expect(res.source).toBe('fallback');
    expect(res.rates.INR).toBe(1);
    fetchSpy.mockRestore();
  });
});
