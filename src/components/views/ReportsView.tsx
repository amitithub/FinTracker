import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit3, Printer, Search, Trash2, X } from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import {
  computeCategoryBreakdown,
  filterExpenses,
  formatMonthLabel,
  ReportRange,
} from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { downloadCsv, generateExpensesCsv } from '../../lib/export';
import { CATEGORIES, CURRENCIES, CurrencyCode, Expense, ExpenseCategory } from '../../types/expense';

interface ReportsViewProps {
  activeMonthKey: string;
  initialCategoryFilter: ExpenseCategory | 'All';
  onEditExpense: (expense: Expense) => void;
}

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: 'month', label: 'Selected Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All History' },
];

export function ReportsView({
  activeMonthKey,
  initialCategoryFilter,
  onEditExpense,
}: ReportsViewProps) {
  const { expenses, preferences, removeExpense, pushToast } = useLedger();

  const [range, setRange] = useState<ReportRange>('all');
  const [category, setCategory] = useState<ExpenseCategory | 'All'>(initialCategoryFilter);
  const [currency, setCurrency] = useState<CurrencyCode | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategoryFilter);
  }, [initialCategoryFilter]);

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        range,
        referenceMonthKey: activeMonthKey,
        category,
        currency,
        searchQuery,
      }),
    [expenses, range, activeMonthKey, category, currency, searchQuery],
  );

  const totalConverted = useMemo(
    () => Math.round(filtered.reduce((s, e) => s + e.convertedAmount, 0) * 100) / 100,
    [filtered],
  );

  const topCategory = useMemo(() => {
    const breakdown = computeCategoryBreakdown(filtered);
    return breakdown[0] || null;
  }, [filtered]);

  const topExpense = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((max, cur) =>
      cur.convertedAmount > max.convertedAmount ? cur : max,
    );
  }, [filtered]);

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      pushToast('info', 'No matching expenses to export.');
      return;
    }
    const csv = generateExpensesCsv(filtered, preferences.baseCurrency);
    downloadCsv(csv, `fintrack-report-${range}-${activeMonthKey}.csv`);
    pushToast('success', `Exported ${filtered.length} rows to CSV.`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async (exp: Expense) => {
    try {
      await removeExpense(exp.id);
      setConfirmDeleteId(null);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to delete expense.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Formal Header */}
      <div className="hidden print-only border-b border-slate-300 pb-4 mb-4">
        <h1 className="text-2xl font-bold text-slate-900">FinTrack Expense Report</h1>
        <p className="text-xs text-slate-600 mt-1">
          Scope: {RANGE_OPTIONS.find((r) => r.value === range)?.label} · Reference Month:{' '}
          {formatMonthLabel(activeMonthKey, true)} · Base Currency: {preferences.baseCurrency} ·
          Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Controls & Export Bar */}
      <div className="no-print rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  range === opt.value
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, notes, category..."
              aria-label="Search expenses"
              className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-4">
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory | 'All')}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <select
              aria-label="Filter by original currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode | 'All')}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
            >
              <option value="All">All FX</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="print-surface rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Report Total</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totalConverted, preferences.baseCurrency)}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Matching Entries</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {filtered.length}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Top Category</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1.5 truncate">
            {topCategory ? `${topCategory.category} (${topCategory.percentage}%)` : '—'}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Largest Single Item</div>
          <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5 truncate">
            {topExpense
              ? `${formatCurrency(topExpense.convertedAmount, preferences.baseCurrency)} · ${topExpense.title}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Responsive Ledger Table (Desktop) & Tap Rows (Mobile) */}
      <div className="print-surface rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No expenses match the selected filters. Try switching to &ldquo;All History&rdquo; or
            clearing the search query.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Original</th>
                    <th className="py-3 px-4 text-right">Converted ({preferences.baseCurrency})</th>
                    <th className="py-3 px-5 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filtered.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-5 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {exp.date}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {exp.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {exp.currency !== preferences.baseCurrency
                          ? formatCurrency(exp.amount, exp.currency)
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(exp.convertedAmount, preferences.baseCurrency)}
                      </td>
                      <td className="py-2.5 px-5 text-right no-print whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditExpense(exp)}
                            aria-label={`Edit ${exp.title}`}
                            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === exp.id ? (
                            <div className="inline-flex items-center gap-1">
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
                                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(exp.id)}
                              aria-label={`Delete ${exp.title}`}
                              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((exp) => (
                <div key={exp.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {exp.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {exp.category} · <span className="font-mono tabular-nums">{exp.date}</span>
                    </div>
                    {exp.notes && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {exp.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right mr-1">
                      <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(exp.convertedAmount, preferences.baseCurrency)}
                      </div>
                      {exp.currency !== preferences.baseCurrency && (
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatCurrency(exp.amount, exp.currency)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditExpense(exp)}
                      aria-label={`Edit ${exp.title}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600"
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
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
