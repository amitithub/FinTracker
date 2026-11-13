import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftRight, X } from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import { getTodayDateStr } from '../../lib/analytics';
import { convertCurrency, formatCurrency, getExchangeRate } from '../../lib/currency';
import { validateExpenseInput } from '../../lib/validation';
import {
  CATEGORIES,
  CURRENCIES,
  CurrencyCode,
  Expense,
  ExpenseCategory,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../types/expense';

interface ExpenseModalProps {
  open: boolean;
  editingExpense: Expense | null;
  onClose: () => void;
}

export function ExpenseModal({ open, editingExpense, onClose }: ExpenseModalProps) {
  const { preferences, rates, addExpense, editExpense, removeExpense, pushToast } = useLedger();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(preferences.baseCurrency);
  const [customRate, setCustomRate] = useState<string>('1');
  const [useManualRate, setUseManualRate] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('Food & Dining');
  const [date, setDate] = useState(getTodayDateStr());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editingExpense) {
      setTitle(editingExpense.title);
      setAmount(String(editingExpense.amount));
      setCurrency(editingExpense.currency);
      setCustomRate(String(editingExpense.exchangeRate));
      setUseManualRate(true);
      setCategory(editingExpense.category);
      setDate(editingExpense.date);
      setNotes(editingExpense.notes || '');
    } else {
      setTitle('');
      setAmount('');
      setCurrency(preferences.baseCurrency);
      setCustomRate('1');
      setUseManualRate(false);
      setCategory('Food & Dining');
      setDate(getTodayDateStr());
      setNotes('');
    }
    setErrors({});
  }, [open, editingExpense, preferences.baseCurrency]);

  const effectiveRate = useManualRate
    ? Number(customRate) || 0
    : getExchangeRate(currency, preferences.baseCurrency, rates, preferences.baseCurrency);

  const numericAmount = Number(amount) || 0;
  const previewConverted = useManualRate
    ? Math.round(numericAmount * effectiveRate * 100) / 100
    : convertCurrency(
        numericAmount,
        currency,
        preferences.baseCurrency,
        rates,
        preferences.baseCurrency,
      ).convertedAmount;

  const handleCurrencyChange = (nextCurrency: CurrencyCode) => {
    setCurrency(nextCurrency);
    const autoRate = getExchangeRate(
      nextCurrency,
      preferences.baseCurrency,
      rates,
      preferences.baseCurrency,
    );
    setCustomRate(String(autoRate));
    setUseManualRate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateExpenseInput({
      title,
      amount,
      currency,
      exchangeRate: effectiveRate,
      category,
      date,
      notes,
      recurringId: editingExpense?.recurringId,
    });

    if (!result.valid || !result.sanitized) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        await editExpense(editingExpense.id, result.sanitized);
      } else {
        await addExpense(result.sanitized);
      }
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingExpense) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await removeExpense(editingExpense.id);
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to delete expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <h2
                id="expense-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                {editingExpense ? 'Edit Expense' : 'Log Expense'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 pb-safe">
              <div>
                <label
                  htmlFor="exp-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Merchant or Description
                </label>
                <input
                  id="exp-title"
                  type="text"
                  maxLength={MAX_TITLE_LENGTH}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Trader Joe's Groceries"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.title && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <label
                    htmlFor="exp-amount"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Amount
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.amount && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.amount}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label
                    htmlFor="exp-currency"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Currency
                  </label>
                  <select
                    id="exp-currency"
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currency !== preferences.baseCurrency && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Converts to{' '}
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(previewConverted, preferences.baseCurrency)}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUseManualRate((prev) => !prev);
                        setCustomRate(String(effectiveRate));
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {useManualRate ? 'Use live rate' : 'Edit rate'}
                    </button>
                  </div>
                  {useManualRate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        1 {currency} =
                      </span>
                      <input
                        type="number"
                        step="0.000001"
                        min="0.000001"
                        aria-label="Custom exchange rate"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        className="flex-1 min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {preferences.baseCurrency}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      1 {currency} = {effectiveRate} {preferences.baseCurrency}
                    </p>
                  )}
                  {errors.exchangeRate && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.exchangeRate}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="exp-category"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="exp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="exp-date"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Date
                  </label>
                  <input
                    id="exp-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.date && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.date}</p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="exp-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="exp-notes"
                  rows={2}
                  maxLength={MAX_NOTES_LENGTH}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Receipt details, project reference, or split info..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {editingExpense ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleDelete}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      confirmDelete
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    }`}
                  >
                    {confirmDelete ? 'Confirm Delete' : 'Delete Entry'}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : editingExpense ? 'Save Changes' : 'Save Expense'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
