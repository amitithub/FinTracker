import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Edit3,
  FileDown,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import {
  collectAvailableMonths,
  computeCategoryBreakdown,
  computeFilteredLineSeries,
  ExpenseSortOrder,
  filterExpenses,
  formatMonthLabel,
  ReportRange,
} from '../../lib/analytics';
import { formatCurrency } from '../../lib/currency';
import { downloadCsv, downloadExpensesPdf, generateExpensesCsv } from '../../lib/export';
import { CATEGORIES, CURRENCIES, CurrencyCode, Expense, ExpenseCategory } from '../../types/expense';
import { CategoryDonutChart } from '../charts/CategoryDonutChart';
import { DailySpendLineChart } from '../charts/DailySpendLineChart';

interface ReportsViewProps {
  activeMonthKey: string;
  initialCategoryFilter: ExpenseCategory | 'All';
  onEditExpense: (expense: Expense) => void;
  onOpenImport?: () => void;
}

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: 'month', label: 'Selected Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All History' },
  { value: 'custom', label: 'Custom Dates' },
];

const SORT_OPTIONS: { value: ExpenseSortOrder; label: string }[] = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'amount-desc', label: 'Highest Amount' },
  { value: 'amount-asc', label: 'Lowest Amount' },
];

export function ReportsView({
  activeMonthKey,
  initialCategoryFilter,
  onEditExpense,
  onOpenImport,
}: ReportsViewProps) {
  const { expenses, preferences, removeExpense, downloadBackup, pushToast } = useLedger();

  const [range, setRange] = useState<ReportRange>('all');
  const [specificMonth, setSpecificMonth] = useState<string>('');
  const [exactDate, setExactDate] = useState<string>('');
  const [useExactDate, setUseExactDate] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | 'All'>(initialCategoryFilter);
  const [currency, setCurrency] = useState<CurrencyCode | 'All'>('All');
  const [minAmountStr, setMinAmountStr] = useState('');
  const [maxAmountStr, setMaxAmountStr] = useState('');
  const [sortBy, setSortBy] = useState<ExpenseSortOrder>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategoryFilter);
  }, [initialCategoryFilter]);

  const availableMonths = useMemo(
    () => collectAvailableMonths(expenses, activeMonthKey),
    [expenses, activeMonthKey],
  );

  const dateFilterValue = useExactDate
    ? 'exact'
    : specificMonth
      ? `ym:${specificMonth}`
      : range;

  const handleDateFilterChange = (val: string) => {
    if (val === 'exact') {
      setUseExactDate(true);
      setSpecificMonth('');
      setRange('custom');
      return;
    }
    setUseExactDate(false);
    if (val.startsWith('ym:')) {
      setSpecificMonth(val.slice(3));
      setRange('month');
      return;
    }
    setSpecificMonth('');
    setRange(val as ReportRange);
  };

  const minAmount = minAmountStr.trim() !== '' ? Number(minAmountStr) : null;
  const maxAmount = maxAmountStr.trim() !== '' ? Number(maxAmountStr) : null;

  const hasActiveFilters =
    range !== 'all' ||
    specificMonth !== '' ||
    useExactDate ||
    category !== 'All' ||
    currency !== 'All' ||
    searchQuery.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    minAmountStr.trim() !== '' ||
    maxAmountStr.trim() !== '' ||
    sortBy !== 'date-desc';

  const resetFilters = () => {
    setRange('all');
    setSpecificMonth('');
    setExactDate('');
    setUseExactDate(false);
    setDateFrom('');
    setDateTo('');
    setCategory('All');
    setCurrency('All');
    setMinAmountStr('');
    setMaxAmountStr('');
    setSortBy('date-desc');
    setSearchQuery('');
  };

  const effectiveDateFrom = useExactDate ? exactDate : dateFrom;
  const effectiveDateTo = useExactDate ? exactDate : dateTo;
  const effectiveRefMonth = specificMonth || activeMonthKey;

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        range,
        referenceMonthKey: effectiveRefMonth,
        category,
        currency,
        searchQuery,
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        minAmount,
        maxAmount,
        sortBy,
      }),
    [
      expenses,
      range,
      effectiveRefMonth,
      category,
      currency,
      searchQuery,
      effectiveDateFrom,
      effectiveDateTo,
      minAmount,
      maxAmount,
      sortBy,
    ],
  );

  const totalConverted = useMemo(
    () => Math.round(filtered.reduce((s, e) => s + e.convertedAmount, 0) * 100) / 100,
    [filtered],
  );

  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(filtered), [filtered]);
  const topCategory = categoryBreakdown[0] || null;

  const lineSeries = useMemo(() => computeFilteredLineSeries(filtered), [filtered]);

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
    downloadCsv(csv, `fintrack-report-${range}-${effectiveRefMonth}.csv`);
    pushToast('success', `Exported ${filtered.length} rows to CSV.`);
  };

  const activeScopeLabel = specificMonth
    ? formatMonthLabel(specificMonth, true)
    : useExactDate && exactDate
      ? `Date ${exactDate}`
      : RANGE_OPTIONS.find((r) => r.value === range)?.label || 'Custom';

  const handleDownloadPdf = () => {
    if (filtered.length === 0) {
      pushToast('info', 'No matching expenses to export.');
      return;
    }
    downloadExpensesPdf(
      {
        expenses: filtered,
        baseCurrency: preferences.baseCurrency,
        scopeLabel: activeScopeLabel,
        referenceMonthLabel: formatMonthLabel(effectiveRefMonth, true),
        topCategoryLabel: topCategory ? `${topCategory.category} (${topCategory.percentage}%)` : '-',
      },
      `fintrack-report-${range}-${effectiveRefMonth}.pdf`,
    );
    pushToast('success', `Downloaded PDF report (${filtered.length} entries).`);
  };

  const handlePrint = () => {
    try {
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      window.print();
      if (inIframe) {
        pushToast(
          'info',
          'Print dialog requested. If blocked by the preview iframe, click Download PDF to save your report.',
        );
      }
    } catch {
      handleDownloadPdf();
    }
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
          Scope: {activeScopeLabel} · Reference Month: {formatMonthLabel(effectiveRefMonth, true)} ·
          Base Currency: {preferences.baseCurrency} · Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Controls & Export Bar */}
      <div className="no-print rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {RANGE_OPTIONS.map((opt) => {
              const isActive =
                !useExactDate && !specificMonth && range === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleDateFilterChange(opt.value)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import CSV / Excel
              </button>
            )}
            <button
              type="button"
              onClick={downloadBackup}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Archive className="w-4 h-4" />
              Backup JSON
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Primary Search & Dropdown Filters (Description, Category, Date/Period, FX & Sort) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, notes, category..."
              aria-label="Search expenses by description"
              className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear description search"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="sm:col-span-3">
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
          <div className="sm:col-span-3">
            <select
              aria-label="Filter by date or period"
              value={dateFilterValue}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
            >
              <optgroup label="Quick Ranges">
                <option value="all">All Dates (History)</option>
                <option value="month">Selected Month ({formatMonthLabel(activeMonthKey)})</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="ytd">Year to Date</option>
                <option value="exact">Exact Calendar Date...</option>
                <option value="custom">Custom Date Range...</option>
              </optgroup>
              <optgroup label="Specific Month">
                {availableMonths.map((mk) => (
                  <option key={mk} value={`ym:${mk}`}>
                    {formatMonthLabel(mk, true)}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <select
              aria-label="Filter by original currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode | 'All')}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-slate-100"
            >
              <option value="All">All FX</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              aria-expanded={showAdvancedFilters}
              aria-label="Toggle amount, sort, and date filters"
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                showAdvancedFilters || range === 'custom' || useExactDate
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Extended Exact Date / Custom Date Range, Amount Bounds & Sort Order */}
        {(showAdvancedFilters || range === 'custom' || useExactDate) && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {useExactDate ? (
              <div>
                <label
                  htmlFor="report-exact-date"
                  className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Exact Date
                </label>
                <input
                  id="report-exact-date"
                  type="date"
                  value={exactDate}
                  onChange={(e) => setExactDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            ) : range === 'custom' ? (
              <>
                <div>
                  <label
                    htmlFor="report-date-from"
                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    From Date
                  </label>
                  <input
                    id="report-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="report-date-to"
                    className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    To Date
                  </label>
                  <input
                    id="report-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </>
            ) : null}
            <div>
              <label
                htmlFor="report-min-amount"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Min Amount ({preferences.baseCurrency})
              </label>
              <input
                id="report-min-amount"
                type="number"
                min="0"
                step="1"
                value={minAmountStr}
                onChange={(e) => setMinAmountStr(e.target.value)}
                placeholder="0"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="report-max-amount"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Max Amount ({preferences.baseCurrency})
              </label>
              <input
                id="report-max-amount"
                type="number"
                min="0"
                step="1"
                value={maxAmountStr}
                onChange={(e) => setMaxAmountStr(e.target.value)}
                placeholder="No limit"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="report-sort-order"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                Sort Order
              </label>
              <select
                id="report-sort-order"
                aria-label="Sort expenses"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ExpenseSortOrder)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{filtered.length}</strong> of{' '}
              <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{expenses.length}</strong> entries
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Report Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="print-surface rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Report Total</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totalConverted, preferences.baseCurrency)}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Matching Entries</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {filtered.length}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Top Category</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1.5 truncate">
            {topCategory ? `${topCategory.category} (${topCategory.percentage}%)` : '—'}
          </div>
        </div>
        <div className="print-surface rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Largest Single Item</div>
          <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5 truncate">
            {topExpense
              ? `${formatCurrency(topExpense.convertedAmount, preferences.baseCurrency)} · ${topExpense.title}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Live Filtered Visualizations (Line Chart + Interactive Category Breakdown) */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <DailySpendLineChart
            title="Filtered Spending Line Chart"
            subtitle={
              lineSeries.granularity === 'daily'
                ? 'Daily spending & cumulative progression for matching entries'
                : 'Monthly spending & cumulative trajectory across matching history'
            }
            points={lineSeries.points}
            baseCurrency={preferences.baseCurrency}
            defaultSeries="daily"
          />
        </div>
        <div className="lg:col-span-5">
          <CategoryDonutChart
            title="Filtered Category Share"
            subtitle="Click any category to toggle filtering"
            items={categoryBreakdown}
            totalSpent={totalConverted}
            baseCurrency={preferences.baseCurrency}
            selectedCategory={category}
            onSelectCategory={(cat) => setCategory((prev) => (prev === cat ? 'All' : cat))}
          />
        </div>
      </div>

      {/* Responsive Ledger Table (Desktop) & Tap Rows (Mobile) */}
      <div className="print-surface rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No expenses match the selected filters. Try switching to &ldquo;All History&rdquo; or
            resetting active filters.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block print-table-wrap overflow-x-auto">
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
            <div className="md:hidden print-hide divide-y divide-slate-100 dark:divide-slate-800">
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
