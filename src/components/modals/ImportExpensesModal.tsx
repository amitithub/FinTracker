import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import { formatCurrency } from '../../lib/currency';
import { downloadCsv } from '../../lib/export';
import {
  buildExpenseImportPreview,
  buildExpenseImportTemplateCsv,
  detectImportColumnMapping,
  ImportColumnMapping,
  readUploadedExpenseSheet,
  SpreadsheetRows,
} from '../../lib/importExpenses';
import { CURRENCIES, CurrencyCode } from '../../types/expense';

interface ImportExpensesModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportExpensesModal({ open, onClose }: ImportExpensesModalProps) {
  const { expenses, preferences, rates, importExpenses, downloadBackup, pushToast } = useLedger();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<SpreadsheetRows>([]);
  const [mapping, setMapping] = useState<ImportColumnMapping>({
    date: -1,
    title: -1,
    amount: -1,
    category: -1,
    currency: -1,
    exchangeRate: -1,
    notes: -1,
  });
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(preferences.baseCurrency);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [convertNegative, setConvertNegative] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return rows[0].map((cell, idx) => {
      const label = String(cell ?? '').trim();
      return label || `Column ${idx + 1}`;
    });
  }, [rows]);

  const preview = useMemo(() => {
    if (rows.length <= 1) {
      return { validRows: [], invalidRows: [], duplicateCount: 0, totalBaseAmount: 0 };
    }
    return buildExpenseImportPreview({
      rows,
      mapping,
      defaultCurrency,
      baseCurrency: preferences.baseCurrency,
      rates,
      existingExpenses: expenses,
      convertNegativeToPositive: convertNegative,
    });
  }, [rows, mapping, defaultCurrency, preferences.baseCurrency, rates, expenses, convertNegative]);

  const rowsToImport = useMemo(() => {
    const selected = skipDuplicates
      ? preview.validRows.filter((r) => !r.isDuplicate)
      : preview.validRows;
    return selected.map((r) => r.sanitized);
  }, [preview.validRows, skipDuplicates]);

  const selectedTotal = useMemo(
    () => Math.round(rowsToImport.reduce((sum, r) => sum + r.convertedAmount, 0) * 100) / 100,
    [rowsToImport],
  );

  const resetState = () => {
    setFileName('');
    setRows([]);
    setParseError(null);
    setDefaultCurrency(preferences.baseCurrency);
    setSkipDuplicates(true);
    setConvertNegative(false);
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    setParsing(true);
    setParseError(null);
    try {
      const parsedRows = await readUploadedExpenseSheet(file);
      if (parsedRows.length <= 1) {
        throw new Error('The uploaded file must include a header row and at least one expense row.');
      }
      const headerLabels = parsedRows[0].map((c, idx) => {
        const text = String(c ?? '').trim();
        return text || `Column ${idx + 1}`;
      });
      setFileName(file.name);
      setRows(parsedRows);
      setMapping(detectImportColumnMapping(headerLabels));
      setDefaultCurrency(preferences.baseCurrency);
    } catch (err) {
      setRows([]);
      setFileName('');
      setParseError(err instanceof Error ? err.message : 'Unable to read spreadsheet file.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = buildExpenseImportTemplateCsv(preferences.baseCurrency);
    downloadCsv(csv, `fintrack-import-template-${preferences.baseCurrency.toLowerCase()}.csv`);
    pushToast('info', 'Downloaded sample CSV expense template.');
  };

  const handleConfirmImport = async () => {
    if (rowsToImport.length === 0) {
      pushToast('info', 'No new valid rows available to import.');
      return;
    }
    setImporting(true);
    try {
      await importExpenses(rowsToImport);
      resetState();
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to import expenses.');
    } finally {
      setImporting(false);
    }
  };

  const updateMapField = (field: keyof ImportColumnMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: Number(value),
    }));
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-expenses-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <h2
                    id="import-expenses-title"
                    className="text-lg font-bold text-slate-900 dark:text-slate-100"
                  >
                    Import Expenses (CSV or Excel)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload .csv, .xlsx, or .xls bank statements with automatic column mapping
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close import modal"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 pb-safe">
              {/* Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border border-dashed p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {fileName ? `Loaded: ${fileName}` : 'Choose or drop a CSV or Excel (.xlsx) file'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports FinTrack CSV exports, Excel .xlsx sheets, and standard bank statements (up to 2,000 rows).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV Template
                  </button>
                  <button
                    type="button"
                    disabled={parsing}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-60"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {parsing ? 'Reading file...' : fileName ? 'Choose Another File' : 'Select CSV / Excel'}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  aria-label="Upload expense CSV or Excel file"
                  className="hidden"
                />
              </div>

              {parseError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {rows.length > 1 && (
                <>
                  {/* Column Mapping Controls */}
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Column Mapping &amp; Import Options
                      </h3>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {rows.length - 1} data rows detected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label
                          htmlFor="map-col-date"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Date *
                        </label>
                        <select
                          id="map-col-date"
                          value={mapping.date}
                          onChange={(e) => updateMapField('date', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>— Not mapped —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="map-col-title"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Description *
                        </label>
                        <select
                          id="map-col-title"
                          value={mapping.title}
                          onChange={(e) => updateMapField('title', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>— Not mapped —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="map-col-amount"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Amount *
                        </label>
                        <select
                          id="map-col-amount"
                          value={mapping.amount}
                          onChange={(e) => updateMapField('amount', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>— Not mapped —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="map-col-category"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Category
                        </label>
                        <select
                          id="map-col-category"
                          value={mapping.category}
                          onChange={(e) => updateMapField('category', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>Auto / Other</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="map-col-currency"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Currency Column
                        </label>
                        <select
                          id="map-col-currency"
                          value={mapping.currency}
                          onChange={(e) => updateMapField('currency', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>Use fallback ({defaultCurrency})</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="import-default-currency"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Fallback Currency
                        </label>
                        <select
                          id="import-default-currency"
                          value={defaultCurrency}
                          onChange={(e) => setDefaultCurrency(e.target.value as CurrencyCode)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="map-col-notes"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Notes
                        </label>
                        <select
                          id="map-col-notes"
                          value={mapping.notes}
                          onChange={(e) => updateMapField('notes', e.target.value)}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                        >
                          <option value={-1}>— None —</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col justify-end gap-1.5 pb-1">
                        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={skipDuplicates}
                            onChange={(e) => setSkipDuplicates(e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-600"
                          />
                          Skip duplicates
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={convertNegative}
                            onChange={(e) => setConvertNegative(e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-600"
                          />
                          Negatives as debits
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Preview Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Ready to Import</div>
                      <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {rowsToImport.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Import Total</div>
                      <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatCurrency(selectedTotal, preferences.baseCurrency)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Duplicates Matched</div>
                      <div className="text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                        {preview.duplicateCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Skipped / Invalid</div>
                      <div className="text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                        {preview.invalidRows.length}
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  {preview.validRows.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="max-h-56 overflow-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                            <tr className="text-slate-500 dark:text-slate-400">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Amount</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {preview.validRows.slice(0, 50).map((item) => (
                              <tr
                                key={item.rowNumber}
                                className={
                                  item.isDuplicate && skipDuplicates
                                    ? 'opacity-50'
                                    : ''
                                }
                              >
                                <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {item.sanitized.date}
                                </td>
                                <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-medium truncate max-w-[200px]">
                                  {item.sanitized.title}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {item.sanitized.category}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {formatCurrency(item.sanitized.amount, item.sanitized.currency)}
                                </td>
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  {item.isDuplicate && skipDuplicates ? (
                                    <span className="text-amber-600 dark:text-amber-400">Duplicate · Skipped</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Ready
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {preview.validRows.length > 50 && (
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                          Showing first 50 of {preview.validRows.length} parsed entries.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Invalid Row Details */}
                  {preview.invalidRows.length > 0 && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                        Skipped rows ({preview.invalidRows.length})
                      </div>
                      <ul className="space-y-1 max-h-24 overflow-y-auto text-[11px] text-rose-700 dark:text-rose-300">
                        {preview.invalidRows.slice(0, 15).map((err) => (
                          <li key={err.rowNumber}>
                            Row {err.rowNumber}: {err.reason} ({err.rawPreview})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={downloadBackup}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Save JSON Backup First
                </button>

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={importing || rowsToImport.length === 0}
                    onClick={handleConfirmImport}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {importing
                      ? 'Importing...'
                      : `Import ${rowsToImport.length} ${rowsToImport.length === 1 ? 'Expense' : 'Expenses'}`}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
