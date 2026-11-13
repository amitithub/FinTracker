import { describe, expect, it } from 'vitest';
import {
  advanceRecurringDate,
  collectAvailableMonths,
  computeBudgetEvaluations,
  computeCategoryBreakdown,
  computeMonthComparison,
  computeMonthlyTotals,
  computeMonthlyTrend,
  evaluateBudgetStatus,
  filterExpenses,
  formatMonthLabel,
  getDaysInMonth,
  getRecentMonthKeys,
  shiftMonthKey,
} from '../lib/analytics';
import { buildSampleDataset } from '../lib/demoData';
import { CategoryBudget, Expense } from '../types/expense';

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'e1',
    ownerId: 'u1',
    title: 'Rent',
    amount: 1500,
    currency: 'USD',
    exchangeRate: 1,
    convertedAmount: 1500,
    category: 'Housing',
    date: '2026-11-01',
    monthKey: '2026-11',
    notes: 'Monthly lease',
  },
  {
    id: 'e2',
    ownerId: 'u1',
    title: 'Groceries',
    amount: 200,
    currency: 'USD',
    exchangeRate: 1,
    convertedAmount: 200,
    category: 'Food & Dining',
    date: '2026-11-05',
    monthKey: '2026-11',
    notes: '',
  },
  {
    id: 'e3',
    ownerId: 'u1',
    title: 'Prior Month Rent',
    amount: 1500,
    currency: 'USD',
    exchangeRate: 1,
    convertedAmount: 1500,
    category: 'Housing',
    date: '2026-10-01',
    monthKey: '2026-10',
    notes: '',
  },
];

describe('analytics and reporting engine', () => {
  it('shifts and formats month keys accurately', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(formatMonthLabel('2026-11')).toBe('Nov 2026');
    expect(getDaysInMonth('2024-02')).toBe(29);
    expect(getRecentMonthKeys('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('advances recurring dates safely across month-end and leap years', () => {
    expect(advanceRecurringDate('2026-11-10', 'weekly')).toBe('2026-11-17');
    expect(advanceRecurringDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(advanceRecurringDate('2024-01-31', 'monthly')).toBe('2024-02-29');
    expect(advanceRecurringDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });

  it('computes monthly totals, MoM comparison, trend, and category breakdown', () => {
    const totals = computeMonthlyTotals(SAMPLE_EXPENSES, '2026-11');
    expect(totals.total).toBe(1700);
    expect(totals.count).toBe(2);
    expect(totals.byCategory.Housing).toBe(1500);

    const comp = computeMonthComparison(SAMPLE_EXPENSES, '2026-11');
    expect(comp.previousTotal).toBe(1500);
    expect(comp.deltaAmount).toBe(200);
    expect(comp.deltaPercent).toBeCloseTo(13.3, 1);

    const trend = computeMonthlyTrend(SAMPLE_EXPENSES, ['2026-10', '2026-11']);
    expect(trend).toHaveLength(2);
    expect(trend[0].total).toBe(1500);
    expect(trend[1].total).toBe(1700);

    const breakdown = computeCategoryBreakdown(SAMPLE_EXPENSES);
    expect(breakdown[0].category).toBe('Housing');
    expect(breakdown[0].total).toBe(3000);
  });

  it('evaluates budget threshold alerts accurately', () => {
    expect(evaluateBudgetStatus(50, 100, 80).status).toBe('on_track');
    expect(evaluateBudgetStatus(85, 100, 80).status).toBe('approaching');
    expect(evaluateBudgetStatus(110, 100, 80).status).toBe('exceeded');

    const budgets: CategoryBudget[] = [
      {
        id: 'b1',
        ownerId: 'u1',
        category: 'Food & Dining',
        monthlyLimit: 220,
        alertThresholdPercent: 80,
      },
    ];
    const evals = computeBudgetEvaluations(SAMPLE_EXPENSES, budgets, '2026-11', 2000);
    expect(evals.overall?.status).toBe('approaching'); // 1700/2000 = 85%
    expect(evals.categories[0].status).toBe('approaching'); // 200/220 = 90.9%
  });

  it('filters expenses by range, category, currency, and search query', () => {
    const res = filterExpenses(SAMPLE_EXPENSES, {
      range: 'month',
      referenceMonthKey: '2026-11',
      category: 'Food & Dining',
      currency: 'All',
      searchQuery: 'groc',
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('e2');

    expect(collectAvailableMonths(SAMPLE_EXPENSES, '2026-11')).toEqual(['2026-11', '2026-10']);

    const allRes = filterExpenses(SAMPLE_EXPENSES, {
      range: 'all',
      referenceMonthKey: '2026-11',
      category: 'All',
      currency: 'USD',
      searchQuery: '',
    });
    expect(allRes).toHaveLength(3);

    const range6m = filterExpenses(SAMPLE_EXPENSES, {
      range: '6m',
      referenceMonthKey: '2026-11',
      category: 'All',
      currency: 'All',
      searchQuery: '',
    });
    expect(range6m).toHaveLength(3);
  });

  it('builds a 6-month sample dataset with INR default currency and budgets', () => {
    const sample = buildSampleDataset('test-owner');
    expect(sample.preferences.baseCurrency).toBe('INR');
    expect(sample.preferences.monthlyBudgetLimit).toBe(50000);
    expect(sample.expenses.length).toBeGreaterThanOrEqual(20);
    expect(sample.budgets.length).toBeGreaterThanOrEqual(4);
    expect(sample.recurringBills.length).toBeGreaterThanOrEqual(3);
    const months = collectAvailableMonths(sample.expenses, sample.expenses[0].monthKey);
    expect(months).toHaveLength(6);
  });
});
