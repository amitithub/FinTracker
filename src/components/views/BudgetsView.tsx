import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import { computeBudgetEvaluations, formatMonthLabel } from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { validateBudgetInput } from '../../lib/validation';
import { CATEGORIES, CATEGORY_COLORS, ExpenseCategory } from '../../types/expense';

interface BudgetsViewProps {
  activeMonthKey: string;
}

export function BudgetsView({ activeMonthKey }: BudgetsViewProps) {
  const { expenses, budgets, preferences, saveBudget, removeBudget, updatePreferences, pushToast } =
    useLedger();

  const [category, setCategory] = useState<ExpenseCategory>('Food & Dining');
  const [monthlyLimit, setMonthlyLimit] = useState('5000');
  const [threshold, setThreshold] = useState('80');
  const [overallInput, setOverallInput] = useState(String(preferences.monthlyBudgetLimit));
  const [saving, setSaving] = useState(false);

  // Inline card edit & 2-step delete state
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editLimitVal, setEditLimitVal] = useState('');
  const [editThresholdVal, setEditThresholdVal] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setOverallInput(String(preferences.monthlyBudgetLimit));
  }, [preferences.monthlyBudgetLimit]);

  const evaluations = computeBudgetEvaluations(
    expenses,
    budgets,
    activeMonthKey,
    preferences.monthlyBudgetLimit,
  );

  const handleSaveOverall = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(overallInput);
    if (!Number.isFinite(num) || num < 0) {
      pushToast('error', 'Enter a valid non-negative overall budget.');
      return;
    }
    setSaving(true);
    try {
      await updatePreferences({
        baseCurrency: preferences.baseCurrency,
        monthlyBudgetLimit: Math.round(num * 100) / 100,
        themePreference: preferences.themePreference,
      });
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save monthly cap.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateBudgetInput({
      category,
      monthlyLimit,
      alertThresholdPercent: threshold,
    });
    if (!res.valid || !res.sanitized) {
      const firstErr = Object.values(res.errors)[0] || 'Invalid budget values.';
      pushToast('error', firstErr);
      return;
    }
    const existing = budgets.find((b) => b.category === res.sanitized!.category);
    setSaving(true);
    try {
      await saveBudget(existing ? existing.id : null, res.sanitized);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not save category budget.');
    } finally {
      setSaving(false);
    }
  };

  const startEditingCard = (item: (typeof evaluations.categories)[number]) => {
    setConfirmDeleteId(null);
    setEditingBudgetId(item.id);
    setEditLimitVal(String(item.limit));
    setEditThresholdVal(String(item.alertThresholdPercent));
  };

  const handleSaveCardEdit = async (cat: ExpenseCategory, budgetId: string) => {
    const res = validateBudgetInput({
      category: cat,
      monthlyLimit: editLimitVal,
      alertThresholdPercent: editThresholdVal,
    });
    if (!res.valid || !res.sanitized) {
      const firstErr = Object.values(res.errors)[0] || 'Invalid budget values.';
      pushToast('error', firstErr);
      return;
    }
    setSaving(true);
    try {
      await saveBudget(budgetId, res.sanitized);
      setEditingBudgetId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not update budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await removeBudget(id);
      setConfirmDeleteId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not remove budget.');
    }
  };

  const renderStatusBadge = (status: 'on_track' | 'approaching' | 'exceeded', label: string) => {
    if (status === 'exceeded') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <AlertOctagon className="w-3.5 h-3.5" />
          {label}
        </span>
      );
    }
    if (status === 'approaching') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall Monthly Cap Card */}
      <div className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Overall Monthly Spending Cap ({formatMonthLabel(activeMonthKey)})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tracks total converted spending across all categories for the active month
            </p>
          </div>
          <form onSubmit={handleSaveOverall} className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              aria-label="Overall monthly cap"
              value={overallInput}
              onChange={(e) => setOverallInput(e.target.value)}
              className="w-32 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap transition-colors"
            >
              Update Cap
            </button>
            {preferences.monthlyBudgetLimit > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await updatePreferences({
                      baseCurrency: preferences.baseCurrency,
                      monthlyBudgetLimit: 0,
                      themePreference: preferences.themePreference,
                    });
                    setOverallInput('0');
                  } catch (err) {
                    pushToast('error', err instanceof Error ? err.message : 'Failed to clear cap.');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap transition-colors"
              >
                Clear Cap
              </button>
            )}
          </form>
        </div>

        {evaluations.overall && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {formatCurrency(evaluations.overall.spent, preferences.baseCurrency)} spent of{' '}
                {formatCurrency(evaluations.overall.limit, preferences.baseCurrency)}
              </span>
              {renderStatusBadge(evaluations.overall.status, evaluations.overall.statusLabel)}
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(1, evaluations.overall.percentUsed / 100) }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left' }}
                className={`h-full w-full ${
                  evaluations.overall.status === 'exceeded'
                    ? 'bg-rose-600'
                    : evaluations.overall.status === 'approaching'
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{evaluations.overall.percentUsed}% consumed</span>
              <span>
                {evaluations.overall.remaining >= 0
                  ? `${formatCurrency(evaluations.overall.remaining, preferences.baseCurrency)} remaining`
                  : `${formatCurrency(Math.abs(evaluations.overall.remaining), preferences.baseCurrency)} over limit`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add / Update Category Limit Form */}
      <form
        onSubmit={handleUpsertCategory}
        className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6"
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Set Category Budget Limit
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label
              htmlFor="bgt-category"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Category
            </label>
            <select
              id="bgt-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label
              htmlFor="bgt-limit"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Limit ({preferences.baseCurrency})
            </label>
            <input
              id="bgt-limit"
              type="number"
              min="1"
              step="1"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="bgt-threshold"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Alert %
            </label>
            <input
              id="bgt-threshold"
              type="number"
              min="10"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </form>

      {/* Category Budgets Grid */}
      {evaluations.categories.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No category budgets defined yet. Add a limit above to track alerts per category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evaluations.categories.map((item) => {
            const catColor =
              item.category !== 'Overall' ? CATEGORY_COLORS[item.category] : '#2563EB';
            const isEditing = editingBudgetId === item.id;
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.category}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Alert at {item.alertThresholdPercent}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {renderStatusBadge(item.status, item.statusLabel)}
                    {!isEditing && !isConfirmingDelete && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditingCard(item)}
                          aria-label={`Edit ${item.category} budget`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Remove ${item.category} budget`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isConfirmingDelete && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteBudget(item.id)}
                          className="min-h-[32px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancel budget deletion"
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && item.category !== 'Overall' ? (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        Limit ({preferences.baseCurrency})
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        aria-label={`Edit ${item.category} limit`}
                        value={editLimitVal}
                        onChange={(e) => setEditLimitVal(e.target.value)}
                        className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        Alert %
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="100"
                        aria-label={`Edit ${item.category} alert percentage`}
                        value={editThresholdVal}
                        onChange={(e) => setEditThresholdVal(e.target.value)}
                        className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div className="col-span-3 flex items-center gap-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveCardEdit(item.category as ExpenseCategory, item.id)}
                        aria-label={`Save ${item.category} budget`}
                        className="flex-1 min-h-[38px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBudgetId(null)}
                        aria-label={`Cancel editing ${item.category} budget`}
                        className="min-w-[38px] min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: Math.min(1, item.percentUsed / 100) }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        style={{ transformOrigin: 'left' }}
                        className={`h-full w-full ${
                          item.status === 'exceeded'
                            ? 'bg-rose-600'
                            : item.status === 'approaching'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        {formatCurrency(item.spent, preferences.baseCurrency)} /{' '}
                        {formatCurrency(item.limit, preferences.baseCurrency)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {item.percentUsed}% ·{' '}
                        {item.remaining >= 0
                          ? `${formatCurrency(item.remaining, preferences.baseCurrency)} left`
                          : `${formatCurrency(Math.abs(item.remaining), preferences.baseCurrency)} over`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
