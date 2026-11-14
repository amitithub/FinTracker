import {
  BillCadence,
  BudgetEvaluation,
  BudgetHealthStatus,
  CATEGORIES,
  CATEGORY_COLORS,
  CategoryBreakdownItem,
  CategoryBudget,
  CurrencyCode,
  Expense,
  ExpenseCategory,
  MonthlyTrendPoint,
} from '../types/expense';

export function getTodayDateStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthKey(now: Date = new Date()): string {
  return getTodayDateStr(now).slice(0, 7);
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string, long = false): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function getDaysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function getRecentMonthKeys(referenceMonthKey: string, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(shiftMonthKey(referenceMonthKey, -i));
  }
  return keys;
}

/**
 * Advances a YYYY-MM-DD recurring bill date safely across weeks, month-ends, and leap years.
 */
export function advanceRecurringDate(dateStr: string, cadence: BillCadence): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (cadence === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().slice(0, 10);
  }
  if (cadence === 'monthly') {
    const targetMonthIndex = m; // 0-indexed next month is `m`
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const normalizedMonth = targetMonthIndex % 12;
    const maxDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(d, maxDay);
    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }
  // yearly
  const nextYear = y + 1;
  const maxDay = new Date(Date.UTC(nextYear, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return `${nextYear}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function computeMonthlyTotals(expenses: Expense[], monthKey: string) {
  const matching = expenses.filter((e) => e.monthKey === monthKey);
  const total = matching.reduce((sum, e) => sum + e.convertedAmount, 0);
  const days = getDaysInMonth(monthKey);
  const byCategory: Record<ExpenseCategory, number> = {} as Record<ExpenseCategory, number>;
  for (const cat of CATEGORIES) {
    byCategory[cat] = 0;
  }
  for (const e of matching) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.convertedAmount;
  }
  return {
    total: Math.round(total * 100) / 100,
    count: matching.length,
    averagePerDay: Math.round((total / days) * 100) / 100,
    averagePerExpense: matching.length > 0 ? Math.round((total / matching.length) * 100) / 100 : 0,
    byCategory,
  };
}

export function computeMonthComparison(expenses: Expense[], currentMonthKey: string) {
  const prevMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentTotal = computeMonthlyTotals(expenses, currentMonthKey).total;
  const previousTotal = computeMonthlyTotals(expenses, prevMonthKey).total;
  const deltaAmount = Math.round((currentTotal - previousTotal) * 100) / 100;
  const deltaPercent =
    previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10 : null;
  return {
    currentTotal,
    previousTotal,
    prevMonthKey,
    deltaAmount,
    deltaPercent,
  };
}

export function computeMonthlyTrend(expenses: Expense[], monthKeys: string[]): MonthlyTrendPoint[] {
  return monthKeys.map((monthKey) => {
    const summary = computeMonthlyTotals(expenses, monthKey);
    return {
      monthKey,
      label: formatMonthLabel(monthKey, false),
      total: summary.total,
      count: summary.count,
    };
  });
}

export function computeCategoryBreakdown(expenses: Expense[]): CategoryBreakdownItem[] {
  const totals = new Map<ExpenseCategory, { total: number; count: number }>();
  let grandTotal = 0;
  for (const e of expenses) {
    grandTotal += e.convertedAmount;
    const prev = totals.get(e.category) || { total: 0, count: 0 };
    totals.set(e.category, {
      total: prev.total + e.convertedAmount,
      count: prev.count + 1,
    });
  }

  return Array.from(totals.entries())
    .map(([category, info]) => ({
      category,
      total: Math.round(info.total * 100) / 100,
      count: info.count,
      percentage: grandTotal > 0 ? Math.round((info.total / grandTotal) * 1000) / 10 : 0,
      color: CATEGORY_COLORS[category] || '#64748B',
    }))
    .sort((a, b) => b.total - a.total);
}

export function evaluateBudgetStatus(
  spent: number,
  limit: number,
  thresholdPercent = 80,
): { status: BudgetHealthStatus; statusLabel: string; percentUsed: number; remaining: number } {
  const safeLimit = limit > 0 ? limit : 0;
  const percentUsed = safeLimit > 0 ? Math.round((spent / safeLimit) * 1000) / 10 : 0;
  const remaining = Math.round((safeLimit - spent) * 100) / 100;

  if (safeLimit > 0 && percentUsed >= 100) {
    return { status: 'exceeded', statusLabel: 'Over Budget', percentUsed, remaining };
  }
  if (safeLimit > 0 && percentUsed >= thresholdPercent) {
    return { status: 'approaching', statusLabel: 'Approaching Limit', percentUsed, remaining };
  }
  return { status: 'on_track', statusLabel: 'On Track', percentUsed, remaining };
}

export function computeBudgetEvaluations(
  expenses: Expense[],
  budgets: CategoryBudget[],
  monthKey: string,
  overallLimit: number,
): { overall: BudgetEvaluation | null; categories: BudgetEvaluation[] } {
  const summary = computeMonthlyTotals(expenses, monthKey);
  const overall =
    overallLimit > 0
      ? {
          id: 'overall',
          category: 'Overall' as const,
          spent: summary.total,
          limit: overallLimit,
          alertThresholdPercent: 80,
          ...evaluateBudgetStatus(summary.total, overallLimit, 80),
        }
      : null;

  const categories: BudgetEvaluation[] = budgets
    .map((b) => {
      const spent = Math.round((summary.byCategory[b.category] || 0) * 100) / 100;
      return {
        id: b.id,
        category: b.category,
        spent,
        limit: b.monthlyLimit,
        alertThresholdPercent: b.alertThresholdPercent,
        ...evaluateBudgetStatus(spent, b.monthlyLimit, b.alertThresholdPercent),
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed);

  return { overall, categories };
}

export type ReportRange = 'month' | '3m' | '6m' | 'ytd' | 'all' | 'custom';
export type ExpenseSortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface ExpenseFilterOptions {
  range: ReportRange;
  referenceMonthKey: string;
  category: ExpenseCategory | 'All';
  currency: CurrencyCode | 'All';
  searchQuery: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  sortBy?: ExpenseSortOrder;
}

export function filterExpenses(expenses: Expense[], opts: ExpenseFilterOptions): Expense[] {
  const query = opts.searchQuery.trim().toLowerCase();
  const validMonths: Set<string> | null = (() => {
    if (opts.range === 'all' || opts.range === 'custom') return null;
    if (opts.range === 'month') return new Set([opts.referenceMonthKey]);
    if (opts.range === '3m') return new Set(getRecentMonthKeys(opts.referenceMonthKey, 3));
    if (opts.range === '6m') return new Set(getRecentMonthKeys(opts.referenceMonthKey, 6));
    // ytd
    const year = opts.referenceMonthKey.slice(0, 4);
    const refMonth = Number(opts.referenceMonthKey.slice(5, 7));
    const set = new Set<string>();
    for (let m = 1; m <= refMonth; m++) {
      set.add(`${year}-${String(m).padStart(2, '0')}`);
    }
    return set;
  })();

  const dateFrom = opts.range === 'custom' && opts.dateFrom ? opts.dateFrom.trim() : '';
  const dateTo = opts.range === 'custom' && opts.dateTo ? opts.dateTo.trim() : '';
  const minAmount =
    opts.minAmount !== undefined && opts.minAmount !== null && Number.isFinite(opts.minAmount)
      ? opts.minAmount
      : null;
  const maxAmount =
    opts.maxAmount !== undefined && opts.maxAmount !== null && Number.isFinite(opts.maxAmount)
      ? opts.maxAmount
      : null;

  const sortBy = opts.sortBy || 'date-desc';

  return expenses
    .filter((e) => {
      if (validMonths && !validMonths.has(e.monthKey)) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      if (opts.category !== 'All' && e.category !== opts.category) return false;
      if (opts.currency !== 'All' && e.currency !== opts.currency) return false;
      if (minAmount !== null && e.convertedAmount < minAmount) return false;
      if (maxAmount !== null && e.convertedAmount > maxAmount) return false;
      if (query) {
        const hay = `${e.title} ${e.category} ${e.notes} ${e.currency}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-asc') {
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      }
      if (sortBy === 'amount-desc') {
        return b.convertedAmount - a.convertedAmount || b.date.localeCompare(a.date);
      }
      if (sortBy === 'amount-asc') {
        return a.convertedAmount - b.convertedAmount || b.date.localeCompare(a.date);
      }
      return b.date.localeCompare(a.date) || b.title.localeCompare(a.title);
    });
}

export interface LineSeriesPoint {
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  cumulative: number;
  count: number;
}

/**
 * Computes day-by-day spending and cumulative burn trajectory for a single YYYY-MM month.
 */
export function computeDailySpendSeries(expenses: Expense[], monthKey: string): LineSeriesPoint[] {
  const days = getDaysInMonth(monthKey);
  const byDay = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    if (e.monthKey !== monthKey) continue;
    const prev = byDay.get(e.date) || { total: 0, count: 0 };
    byDay.set(e.date, {
      total: prev.total + e.convertedAmount,
      count: prev.count + 1,
    });
  }

  let running = 0;
  const points: LineSeriesPoint[] = [];
  for (let d = 1; d <= days; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateKey = `${monthKey}-${dayStr}`;
    const entry = byDay.get(dateKey) || { total: 0, count: 0 };
    const rounded = Math.round(entry.total * 100) / 100;
    running = Math.round((running + rounded) * 100) / 100;
    points.push({
      key: dateKey,
      label: dateKey,
      shortLabel: String(d),
      total: rounded,
      cumulative: running,
      count: entry.count,
    });
  }
  return points;
}

/**
 * Builds an adaptive chronological line series from arbitrary filtered expenses:
 * groups by day if all entries fall within <= 45 days, otherwise aggregates by month.
 */
export function computeFilteredLineSeries(expenses: Expense[]): {
  granularity: 'daily' | 'monthly';
  points: LineSeriesPoint[];
} {
  if (expenses.length === 0) {
    return { granularity: 'monthly', points: [] };
  }

  const uniqueMonths = Array.from(new Set(expenses.map((e) => e.monthKey))).sort();
  if (uniqueMonths.length <= 1) {
    const byDate = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const prev = byDate.get(e.date) || { total: 0, count: 0 };
      byDate.set(e.date, {
        total: prev.total + e.convertedAmount,
        count: prev.count + 1,
      });
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    let running = 0;
    const points = sortedDates.map((dateKey) => {
      const entry = byDate.get(dateKey)!;
      const rounded = Math.round(entry.total * 100) / 100;
      running = Math.round((running + rounded) * 100) / 100;
      return {
        key: dateKey,
        label: dateKey,
        shortLabel: dateKey.slice(5), // MM-DD
        total: rounded,
        cumulative: running,
        count: entry.count,
      };
    });
    return { granularity: 'daily', points };
  }

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const prev = byMonth.get(e.monthKey) || { total: 0, count: 0 };
    byMonth.set(e.monthKey, {
      total: prev.total + e.convertedAmount,
      count: prev.count + 1,
    });
  }
  let running = 0;
  const points = uniqueMonths.map((mk) => {
    const entry = byMonth.get(mk)!;
    const rounded = Math.round(entry.total * 100) / 100;
    running = Math.round((running + rounded) * 100) / 100;
    const label = formatMonthLabel(mk, false);
    return {
      key: mk,
      label,
      shortLabel: label.split(' ')[0],
      total: rounded,
      cumulative: running,
      count: entry.count,
    };
  });
  return { granularity: 'monthly', points };
}

export function collectAvailableMonths(expenses: Expense[], currentMonthKey: string): string[] {
  const set = new Set<string>([currentMonthKey]);
  for (const e of expenses) {
    if (e.monthKey) set.add(e.monthKey);
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
