import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarCheck2, Clock, Edit3, Plus, Trash2, X } from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import { getTodayDateStr } from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { validateRecurringInput } from '../../lib/validation';
import {
  BillCadence,
  CADENCES,
  CATEGORIES,
  CURRENCIES,
  CurrencyCode,
  ExpenseCategory,
  MAX_TITLE_LENGTH,
  RecurringBill,
} from '../../types/expense';

export function RecurringView() {
  const {
    recurringBills,
    preferences,
    addRecurringBill,
    editRecurringBill,
    payRecurringBill,
    removeRecurringBill,
    pushToast,
  } = useLedger();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(preferences.baseCurrency);
  const [category, setCategory] = useState<ExpenseCategory>('Utilities');
  const [cadence, setCadence] = useState<BillCadence>('monthly');
  const [nextDueDate, setNextDueDate] = useState(getTodayDateStr());
  const [saving, setSaving] = useState(false);

  // Edit modal & 2-step delete state
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(preferences.baseCurrency);
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Utilities');
  const [editCadence, setEditCadence] = useState<BillCadence>('monthly');
  const [editDueDate, setEditDueDate] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(preferences.baseCurrency);
  }, [preferences.baseCurrency]);

  const today = getTodayDateStr();
  const sortedBills = [...recurringBills].sort((a, b) =>
    a.nextDueDate.localeCompare(b.nextDueDate),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateRecurringInput({
      title,
      amount,
      currency,
      category,
      cadence,
      nextDueDate,
      autoRemind: true,
    });
    if (!res.valid || !res.sanitized) {
      const firstErr = Object.values(res.errors)[0] || 'Please check recurring bill fields.';
      pushToast('error', firstErr);
      return;
    }
    setSaving(true);
    try {
      await addRecurringBill(res.sanitized);
      setTitle('');
      setAmount('');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to schedule bill.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (bill: RecurringBill) => {
    setConfirmDeleteId(null);
    setEditingBill(bill);
    setEditTitle(bill.title);
    setEditAmount(String(bill.amount));
    setEditCurrency(bill.currency);
    setEditCategory(bill.category);
    setEditCadence(bill.cadence);
    setEditDueDate(bill.nextDueDate);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return;
    const res = validateRecurringInput({
      title: editTitle,
      amount: editAmount,
      currency: editCurrency,
      category: editCategory,
      cadence: editCadence,
      nextDueDate: editDueDate,
      autoRemind: editingBill.autoRemind,
      lastPaidDate: editingBill.lastPaidDate,
    });
    if (!res.valid || !res.sanitized) {
      const firstErr = Object.values(res.errors)[0] || 'Please check recurring bill fields.';
      pushToast('error', firstErr);
      return;
    }
    setSaving(true);
    try {
      await editRecurringBill(editingBill.id, res.sanitized);
      setEditingBill(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to update bill.');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (bill: RecurringBill) => {
    try {
      await payRecurringBill(bill);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to record bill payment.');
    }
  };

  const handleDelete = async (billId: string) => {
    try {
      await removeRecurringBill(billId);
      setConfirmDeleteId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to delete bill.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Recurring Bill Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Schedule Recurring Bill or Subscription
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track fixed bills and log monthly payments with one click
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4">
            <label
              htmlFor="rec-title"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Bill Name
            </label>
            <input
              id="rec-title"
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fiber Internet"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="rec-amount"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Amount
            </label>
            <input
              id="rec-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1179.00"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="rec-currency"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Currency
            </label>
            <select
              id="rec-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="rec-cadence"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Cadence
            </label>
            <select
              id="rec-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as BillCadence)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm capitalize text-slate-900 dark:text-slate-100"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="rec-due"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Next Due
            </label>
            <input
              id="rec-due"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full min-h-[44px] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <label htmlFor="rec-cat" className="text-xs text-slate-500 dark:text-slate-400">
              Category:
            </label>
            <select
              id="rec-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Recurring Bill
          </button>
        </div>
      </form>

      {/* Scheduled Bills List */}
      <div className="rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Active Schedules ({sortedBills.length})
          </h3>
        </div>

        {sortedBills.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No recurring bills scheduled yet. Add rent, utilities, or subscriptions above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedBills.map((bill) => {
              const isOverdue = bill.nextDueDate < today;
              const isDueToday = bill.nextDueDate === today;
              const isConfirming = confirmDeleteId === bill.id;

              return (
                <div
                  key={bill.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {bill.title}
                      </span>
                      {isOverdue && (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Overdue
                        </span>
                      )}
                      {isDueToday && (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Due Today
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {bill.category} · <span className="capitalize">{bill.cadence}</span> · Next
                      due <span className="font-mono tabular-nums">{bill.nextDueDate}</span>
                      {bill.lastPaidDate && (
                        <>
                          {' '}
                          · Last paid{' '}
                          <span className="font-mono tabular-nums">{bill.lastPaidDate}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(bill.amount, bill.currency)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePay(bill)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        Pay &amp; Log
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(bill)}
                        aria-label={`Edit ${bill.title}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(bill.id)}
                            className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            aria-label={`Cancel deleting ${bill.title}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(bill.id)}
                          aria-label={`Delete ${bill.title}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Recurring Bill Modal / Bottom Sheet */}
      <AnimatePresence>
        {editingBill && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-recurring-title"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingBill(null)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3
                  id="edit-recurring-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  Edit Recurring Bill
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  aria-label="Close recurring edit modal"
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4 pb-safe">
                <div>
                  <label
                    htmlFor="edit-rec-title"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Bill Name
                  </label>
                  <input
                    id="edit-rec-title"
                    type="text"
                    maxLength={MAX_TITLE_LENGTH}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-3">
                    <label
                      htmlFor="edit-rec-amount"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Amount
                    </label>
                    <input
                      id="edit-rec-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="col-span-2">
                    <label
                      htmlFor="edit-rec-currency"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Currency
                    </label>
                    <select
                      id="edit-rec-currency"
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="edit-rec-cadence"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Cadence
                    </label>
                    <select
                      id="edit-rec-cadence"
                      value={editCadence}
                      onChange={(e) => setEditCadence(e.target.value as BillCadence)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm capitalize text-slate-900 dark:text-slate-100"
                    >
                      {CADENCES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="edit-rec-due"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Next Due Date
                    </label>
                    <input
                      id="edit-rec-due"
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-rec-category"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="edit-rec-category"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBill(null)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
