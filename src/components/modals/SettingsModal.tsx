import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Database, X } from 'lucide-react';
import { useLedger } from '../../contexts/LedgerContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CURRENCIES,
  CURRENCY_META,
  CurrencyCode,
  MAX_AMOUNT,
  ThemePreference,
} from '../../types/expense';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { preferences, rateSource, updatePreferences, loadSampleHistory, pushToast } = useLedger();
  const { preference: activeThemePreference } = useTheme();

  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>(preferences.baseCurrency);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState(
    String(preferences.monthlyBudgetLimit),
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(activeThemePreference);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBaseCurrency(preferences.baseCurrency);
    setMonthlyBudgetLimit(String(preferences.monthlyBudgetLimit));
    setThemePreference(activeThemePreference);
  }, [open, preferences, activeThemePreference]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = Number(monthlyBudgetLimit);
    if (!Number.isFinite(limitNum) || limitNum < 0 || limitNum > MAX_AMOUNT) {
      pushToast('error', 'Enter a valid monthly budget limit (0 or greater).');
      return;
    }
    setSaving(true);
    try {
      await updatePreferences({
        baseCurrency,
        monthlyBudgetLimit: Math.round(limitNum * 100) / 100,
        themePreference,
      });
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSample = async () => {
    setSeeding(true);
    try {
      await loadSampleHistory();
      onClose();
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to load sample history.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
              <h2
                id="settings-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                Reporting Preferences
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preferences"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 pb-safe">
              <div>
                <label
                  htmlFor="pref-currency"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Primary Reporting Currency
                </label>
                <select
                  id="pref-currency"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code} — {CURRENCY_META[code].name} ({CURRENCY_META[code].symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  FX source: {rateSource === 'live' ? 'Live ECB rates (Frankfurter)' : 'Built-in offline reference rates'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="pref-budget"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Overall Monthly Spending Cap ({baseCurrency})
                </label>
                <input
                  id="pref-budget"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyBudgetLimit}
                  onChange={(e) => setMonthlyBudgetLimit(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Appearance
                </span>
                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setThemePreference(opt)}
                      className={`min-h-[40px] rounded-lg text-xs font-medium capitalize transition-colors ${
                        themePreference === opt
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleLoadSample}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Database className="w-4 h-4" />
                  {seeding ? 'Loading sample months...' : 'Load 6-Month Sample Expense History'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
