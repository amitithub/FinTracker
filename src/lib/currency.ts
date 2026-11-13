import { CURRENCIES, CURRENCY_META, CurrencyCode } from '../types/expense';

// Baseline exchange rates relative to 1 USD (offline fallback when FX API is unreachable)
export const FALLBACK_USD_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 84.4,
  JPY: 153.5,
  CAD: 1.39,
  AUD: 1.53,
  SGD: 1.34,
  CHF: 0.88,
};

export interface ExchangeRateCache {
  base: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  fetchedAt: number;
  source: 'live' | 'fallback';
}

const RATE_CACHE_KEY = 'fintrack-fx-cache-v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function buildRatesForBase(
  baseCurrency: CurrencyCode,
  usdRates: Record<CurrencyCode, number> = FALLBACK_USD_RATES,
): Record<CurrencyCode, number> {
  const basePerUsd = usdRates[baseCurrency] || 1;
  const result = {} as Record<CurrencyCode, number>;
  for (const code of CURRENCIES) {
    const codePerUsd = usdRates[code] || 1;
    // How many units of `baseCurrency` equal 1 unit of `code`? No—standard FX table stores: 1 base = X code.
    result[code] = Math.round((codePerUsd / basePerUsd) * 1_000_000) / 1_000_000;
  }
  result[baseCurrency] = 1;
  return result;
}

/**
 * Returns the multiplier to convert 1 unit of `fromCurrency` into `toCurrency`.
 * `ratesFromBase` maps 1 unit of `baseCurrency` -> X units of target currency.
 */
export function getExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  ratesFromBase: Record<CurrencyCode, number>,
  baseCurrency: CurrencyCode,
): number {
  if (fromCurrency === toCurrency) return 1;
  const fromPerBase = fromCurrency === baseCurrency ? 1 : ratesFromBase[fromCurrency];
  const toPerBase = toCurrency === baseCurrency ? 1 : ratesFromBase[toCurrency];
  if (!fromPerBase || !toPerBase || fromPerBase <= 0 || toPerBase <= 0) {
    const fallbackFrom = FALLBACK_USD_RATES[fromCurrency] || 1;
    const fallbackTo = FALLBACK_USD_RATES[toCurrency] || 1;
    return Math.round((fallbackTo / fallbackFrom) * 1_000_000) / 1_000_000;
  }
  return Math.round((toPerBase / fromPerBase) * 1_000_000) / 1_000_000;
}

export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  ratesFromBase: Record<CurrencyCode, number>,
  baseCurrency: CurrencyCode,
): { convertedAmount: number; exchangeRate: number } {
  if (!Number.isFinite(amount) || amount < 0) {
    return { convertedAmount: 0, exchangeRate: 1 };
  }
  const rate = getExchangeRate(fromCurrency, toCurrency, ratesFromBase, baseCurrency);
  const decimals = CURRENCY_META[toCurrency].decimals;
  const factor = Math.pow(10, decimals);
  const convertedAmount = Math.round(amount * rate * factor) / factor;
  return { convertedAmount, exchangeRate: rate };
}

export function formatCurrency(amount: number, currency: CurrencyCode, compact = false): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const { decimals } = CURRENCY_META[currency];
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      notation: compact && Math.abs(safeAmount) >= 10000 ? 'compact' : 'standard',
    }).format(safeAmount);
  } catch {
    return `${CURRENCY_META[currency].symbol}${safeAmount.toFixed(decimals)}`;
  }
}

/**
 * Fetches live daily ECB rates from the free, open-source, keyless Frankfurter API.
 * Falls back cleanly to built-in offline rates if the network is unavailable.
 */
export async function fetchLiveRates(baseCurrency: CurrencyCode): Promise<ExchangeRateCache> {
  try {
    const cachedRaw = localStorage.getItem(RATE_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as ExchangeRateCache;
      if (
        parsed.base === baseCurrency &&
        Date.now() - parsed.fetchedAt < CACHE_TTL_MS &&
        parsed.rates &&
        typeof parsed.rates[baseCurrency] === 'number'
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage parsing issues
  }

  const fallback: ExchangeRateCache = {
    base: baseCurrency,
    rates: buildRatesForBase(baseCurrency),
    fetchedAt: Date.now(),
    source: 'fallback',
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const targets = CURRENCIES.filter((c) => c !== baseCurrency).join(',');
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(targets)}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    if (!res.ok) return fallback;
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates || typeof json.rates !== 'object') return fallback;

    const merged = { ...fallback.rates };
    for (const code of CURRENCIES) {
      if (code === baseCurrency) {
        merged[code] = 1;
      } else if (typeof json.rates[code] === 'number' && json.rates[code] > 0) {
        merged[code] = json.rates[code];
      }
    }

    const liveResult: ExchangeRateCache = {
      base: baseCurrency,
      rates: merged,
      fetchedAt: Date.now(),
      source: 'live',
    };

    try {
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(liveResult));
    } catch {
      // Ignore storage quota errors
    }

    return liveResult;
  } catch {
    return fallback;
  }
}
