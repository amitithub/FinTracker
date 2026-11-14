import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Database,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import {
  computeBudgetEvaluations,
  computeCategoryBreakdown,
  computeDailySpendSeries,
  computeMonthComparison,
  computeMonthlyTotals,
  computeMonthlyTrend,
  formatMonthLabel,
  getRecentMonthKeys,
  getTodayDateStr,
} from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { Expense, ExpenseCategory } from '../../types/expense';
import { CategoryDonutChart } from '../charts/CategoryDonutChart';
import { DailySpendLineChart } from '../charts/DailySpendLineChart';
import { SpendingTrendChart } from '../charts/SpendingTrendChart';

interface OverviewViewProps {
  activeMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onOpenReports: (category?: ExpenseCategory) => void;
  onOpenBudgets: () => void;
  onOpenRecurring: () => void;
}

export function OverviewView({
  activeMonthKey,
  onSelectMonth,
  onAddExpense,
  onEditExpense,
  onOpenReports,
  onOpenBudgets,
  onOpenRecurring,
}: OverviewViewProps) {
  const {
    expenses,
    budgets,
    recurringBills,
    preferences,
    syncing,
    removeExpense,
    loadSampleHistory,
    pushToast,
  } = useLedger();

  const summary = computeMonthlyTotals(expenses, activeMonthKey);
  const comparison = computeMonthComparison(expenses, activeMonthKey);
  const recentMonths = getRecentMonthKeys(activeMonthKey, 6);
  const trendData = computeMonthlyTrend(expenses, recentMonths);
  const dailySeries = computeDailySpendSeries(expenses, activeMonthKey);

  const monthExpenses = expenses
    .filter((e) => e.monthKey === activeMonthKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  const categoryBreakdown = computeCategoryBreakdown(monthExpenses);
  const budgetEval = computeBudgetEvaluations(
    expenses,
    budgets,
    activeMonthKey,
    preferences.monthlyBudgetLimit,
  );

  const alerts = [
    ...(budgetEval.overall && budgetEval.overall.status !== 'on_track'
      ? [budgetEval.overall]
      : []),
    ...budgetEval.categories.filter((c) => c.status !== 'on_track'),
  ];

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const today = getTodayDateStr();
  const dueBills = recurringBills.filter((b) => b.nextDueDate <= `${activeMonthKey}-31`);
  const overdueBills = recurringBills.filter((b) => b.nextDueDate < today);

  const handleDelete = async (exp: Expense) => {
    try {
      await removeExpense(exp.id);
      setConfirmDeleteId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to delete expense.');
    }
  };

  if (syncing) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="lg:col-span-5 h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center max-w-2xl mx-auto my-6"
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Your cloud ledger is ready
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Log your first expense to start tracking monthly spending trends, or load 6 months of
          sample history to explore interactive reports right away.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={onAddExpense}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log First Expense
          </button>
          <button
            type="button"
            onClick={() => loadSampleHistory()}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Database className="w-4 h-4" />
            Load 6-Month Sample History
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Spent in {formatMonthLabel(activeMonthKey)}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
            {formatCurrency(summary.total, preferences.baseCurrency)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {comparison.deltaPercent === null ? (
              <span className="text-slate-500 dark:text-slate-400">
                {summary.count} {summary.count === 1 ? 'transaction' : 'transactions'}
              </span>
            ) : comparison.deltaAmount > 0 ? (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{comparison.deltaPercent}% vs prior month
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowDownRight className="w-3.5 h-3.5" />
                {comparison.deltaPercent}% vs prior month
              </span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.04 }}
          className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Budget Remaining</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
            {budgetEval.overall
              ? formatCurrency(budgetEval.overall.remaining, preferences.baseCurrency)
              : 'No Cap'}
          </div>
          <div className="mt-2 text-xs">
            {budgetEval.overall ? (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  budgetEval.overall.status === 'exceeded'
                    ? 'text-rose-600 dark:text-rose-400'
                    : budgetEval.overall.status === 'approaching'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {budgetEval.overall.status === 'exceeded' ? (
                  <AlertOctagon className="w-3.5 h-3.5" />
                ) : budgetEval.overall.status === 'approaching' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {budgetEval.overall.statusLabel} · {budgetEval.overall.percentUsed}% used
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenBudgets}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Set monthly cap
              </button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">Daily Burn Average</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
            {formatCurrency(summary.averagePerDay, preferences.baseCurrency)}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Avg ticket {formatCurrency(summary.averagePerExpense, preferences.baseCurrency)}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
          className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">Recurring Bills</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
            {dueBills.length} Scheduled
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={onOpenRecurring}
              className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${
                overdueBills.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              {overdueBills.length > 0
                ? `${overdueBills.length} due now — Review`
                : 'Manage schedules'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Budget Threshold Alert Banner (only when approaching or exceeded) */}
      {alerts.length > 0 && (
        <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Budget Alert: {alerts.length} {alerts.length === 1 ? 'limit' : 'limits'} need
                attention in {formatMonthLabel(activeMonthKey)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {alerts
                  .slice(0, 3)
                  .map((a) => `${a.category} (${a.percentUsed}% · ${a.statusLabel})`)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenBudgets}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Inspect Budgets
          </button>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <SpendingTrendChart
            data={trendData}
            baseCurrency={preferences.baseCurrency}
            activeMonthKey={activeMonthKey}
            budgetLimit={preferences.monthlyBudgetLimit}
            onSelectMonth={onSelectMonth}
          />
        </div>
        <div className="lg:col-span-5">
          <CategoryDonutChart
            items={categoryBreakdown}
            totalSpent={summary.total}
            baseCurrency={preferences.baseCurrency}
            onSelectCategory={(cat) => onOpenReports(cat)}
          />
        </div>
      </div>

      {/* Daily Burn & Cumulative Pace Line Chart */}
      <DailySpendLineChart
        title={`${formatMonthLabel(activeMonthKey, true)} Spend Pace`}
        subtitle="Cumulative burn curve and daily outlays across the selected month"
        points={dailySeries}
        baseCurrency={preferences.baseCurrency}
        budgetLimit={preferences.monthlyBudgetLimit}
        defaultSeries="cumulative"
      />

      {/* Recent Transactions for Selected Month */}
      <div className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatMonthLabel(activeMonthKey, true)} Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {Math.min(8, monthExpenses.length)} of {monthExpenses.length} recorded entries
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenReports()}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 inline-flex items-center gap-1 whitespace-nowrap"
          >
            Full Report
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {monthExpenses.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No expenses logged in {formatMonthLabel(activeMonthKey, true)}.
            </p>
            <button
              type="button"
              onClick={onAddExpense}
              className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {monthExpenses.slice(0, 8).map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {exp.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{exp.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{exp.date}</span>
                    {exp.currency !== preferences.baseCurrency && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(exp.amount, exp.currency)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mr-1">
                    {formatCurrency(exp.convertedAmount, preferences.baseCurrency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditExpense(exp)}
                    aria-label={`Edit ${exp.title}`}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {confirmDeleteId === exp.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(exp)}
                        className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label={`Cancel deleting ${exp.title}`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(exp.id)}
                      aria-label={`Delete ${exp.title}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
