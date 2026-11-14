import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { advanceRecurringDate, getTodayDateStr } from '../lib/analytics';
import { buildRatesForBase, convertCurrency, fetchLiveRates } from '../lib/currency';
import { buildSampleDataset } from '../lib/demoData';
import { downloadJson, generateBackupJson, parseAndValidateBackup } from '../lib/export';
import {
  SanitizedBudgetInput,
  SanitizedExpenseInput,
  SanitizedRecurringInput,
} from '../lib/validation';
import {
  batchCreateExpenses as fsBatchCreateExpenses,
  createExpense as fsCreateExpense,
  createRecurringBill as fsCreateRecurring,
  deleteBudget as fsDeleteBudget,
  deleteExpense as fsDeleteExpense,
  deleteRecurringBill as fsDeleteRecurring,
  markRecurringBillPaid as fsMarkRecurringPaid,
  restoreBackupToCloud,
  savePreferences as fsSavePreferences,
  seedSampleHistoryToCloud,
  subscribeBudgets,
  subscribeExpenses,
  subscribePreferences,
  subscribeRecurringBills,
  updateExpense as fsUpdateExpense,
  updateRecurringBill as fsUpdateRecurring,
  upsertBudget as fsUpsertBudget,
} from '../services/firestoreService';
import {
  CategoryBudget,
  CurrencyCode,
  Expense,
  RecurringBill,
  ThemePreference,
  UserPreferences,
} from '../types/expense';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface LedgerContextValue {
  expenses: Expense[];
  budgets: CategoryBudget[];
  recurringBills: RecurringBill[];
  preferences: UserPreferences;
  rates: Record<CurrencyCode, number>;
  rateSource: 'live' | 'fallback';
  syncing: boolean;
  syncError: string | null;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (type: ToastMessage['type'], message: string) => void;
  addExpense: (input: SanitizedExpenseInput) => Promise<void>;
  importExpenses: (items: SanitizedExpenseInput[]) => Promise<number>;
  editExpense: (id: string, input: SanitizedExpenseInput) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  saveBudget: (existingId: string | null, input: SanitizedBudgetInput) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
  addRecurringBill: (input: SanitizedRecurringInput) => Promise<void>;
  editRecurringBill: (id: string, input: SanitizedRecurringInput) => Promise<void>;
  payRecurringBill: (bill: RecurringBill) => Promise<void>;
  removeRecurringBill: (id: string) => Promise<void>;
  updatePreferences: (updates: {
    baseCurrency: CurrencyCode;
    monthlyBudgetLimit: number;
    themePreference: ThemePreference;
  }) => Promise<void>;
  toggleAppTheme: () => Promise<void>;
  loadSampleHistory: () => Promise<void>;
  downloadBackup: () => void;
  restoreBackup: (rawJson: string) => Promise<{
    expensesCount: number;
    budgetsCount: number;
    recurringCount: number;
  }>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

const DEFAULT_PREFS: UserPreferences = {
  ownerId: 'local',
  baseCurrency: 'INR',
  monthlyBudgetLimit: 50000,
  themePreference: 'system',
};

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemoMode } = useAuth();
  const {
    preference: activeThemePref,
    resolvedTheme,
    setPreference: setThemePreference,
    toggleTheme: toggleLocalTheme,
  } = useTheme();
  const lastRemoteThemeRef = useRef<ThemePreference | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(() => buildRatesForBase('INR'));
  const [rateSource, setRateSource] = useState<'live' | 'fallback'>('fallback');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load FX rates whenever baseCurrency changes
  useEffect(() => {
    let active = true;
    fetchLiveRates(preferences.baseCurrency).then((res) => {
      if (!active) return;
      setRates(res.rates);
      setRateSource(res.source);
    });
    return () => {
      active = false;
    };
  }, [preferences.baseCurrency]);

  // Synchronize either Demo state or Firestore real-time state
  useEffect(() => {
    if (isDemoMode) {
      const sample = buildSampleDataset('demo-user');
      setExpenses(sample.expenses);
      setBudgets(sample.budgets);
      setRecurringBills(sample.recurringBills);
      setPreferences(sample.preferences);
      setSyncing(false);
      setSyncError(null);
      return;
    }

    if (!user || !user.emailVerified) {
      setExpenses([]);
      setBudgets([]);
      setRecurringBills([]);
      setPreferences(DEFAULT_PREFS);
      setSyncing(false);
      setSyncError(null);
      return;
    }

    setSyncing(true);
    setSyncError(null);
    lastRemoteThemeRef.current = null;

    const loadedStreams = new Set<string>();
    const markLoaded = (stream: string) => {
      loadedStreams.add(stream);
      if (loadedStreams.size >= 4) {
        setSyncing(false);
      }
    };

    const handleErr = (err: Error) => {
      setSyncError(err.message);
      setSyncing(false);
    };

    const unsubPrefs = subscribePreferences(
      user.uid,
      (prefs) => {
        if (prefs) {
          setPreferences(prefs);
          if (lastRemoteThemeRef.current !== prefs.themePreference) {
            lastRemoteThemeRef.current = prefs.themePreference;
            setThemePreference(prefs.themePreference);
          }
        } else {
          setPreferences({ ...DEFAULT_PREFS, ownerId: user.uid, themePreference: activeThemePref });
        }
        markLoaded('prefs');
      },
      handleErr,
    );

    const unsubExpenses = subscribeExpenses(
      user.uid,
      (items) => {
        setExpenses(items);
        markLoaded('expenses');
      },
      handleErr,
    );

    const unsubBudgets = subscribeBudgets(
      user.uid,
      (items) => {
        setBudgets(items);
        markLoaded('budgets');
      },
      handleErr,
    );

    const unsubRecurring = subscribeRecurringBills(
      user.uid,
      (items) => {
        setRecurringBills(items);
        markLoaded('recurring');
      },
      handleErr,
    );

    return () => {
      unsubPrefs();
      unsubExpenses();
      unsubBudgets();
      unsubRecurring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, user?.uid, user?.emailVerified, isDemoMode, setThemePreference]);

  const addExpense = useCallback(
    async (input: SanitizedExpenseInput) => {
      if (isDemoMode) {
        const next: Expense = {
          id: `demo_exp_${Date.now()}`,
          ownerId: 'demo-user',
          ...input,
        };
        setExpenses((prev) => [next, ...prev]);
        pushToast('success', `Logged "${input.title}" in preview mode.`);
        return;
      }
      if (!user) return;
      await fsCreateExpense(user.uid, input);
      pushToast('success', `Saved "${input.title}" to cloud ledger.`);
    },
    [isDemoMode, user, pushToast],
  );

  const importExpenses = useCallback(
    async (items: SanitizedExpenseInput[]) => {
      if (items.length === 0) return 0;
      if (isDemoMode) {
        const suffix = Date.now().toString(36);
        const created: Expense[] = items.map((input, idx) => ({
          id: `demo_imp_${suffix}_${idx}`,
          ownerId: 'demo-user',
          ...input,
        }));
        setExpenses((prev) => [...created, ...prev]);
        pushToast('success', `Imported ${items.length} expenses in preview mode.`);
        return items.length;
      }
      if (!user) {
        throw new Error('Sign in or enter preview mode to import expenses.');
      }
      await fsBatchCreateExpenses(user.uid, items);
      pushToast('success', `Imported ${items.length} expenses to cloud ledger.`);
      return items.length;
    },
    [isDemoMode, user, pushToast],
  );

  const editExpense = useCallback(
    async (id: string, input: SanitizedExpenseInput) => {
      if (isDemoMode) {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...input } : e)));
        pushToast('success', `Updated "${input.title}".`);
        return;
      }
      if (!user) return;
      await fsUpdateExpense(user.uid, id, input);
      pushToast('success', `Updated "${input.title}".`);
    },
    [isDemoMode, user, pushToast],
  );

  const removeExpense = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        pushToast('info', 'Expense removed.');
        return;
      }
      if (!user) return;
      await fsDeleteExpense(user.uid, id);
      pushToast('info', 'Expense deleted from cloud ledger.');
    },
    [isDemoMode, user, pushToast],
  );

  const saveBudget = useCallback(
    async (existingId: string | null, input: SanitizedBudgetInput) => {
      if (isDemoMode) {
        if (existingId) {
          setBudgets((prev) =>
            prev.map((b) =>
              b.id === existingId
                ? { ...b, monthlyLimit: input.monthlyLimit, alertThresholdPercent: input.alertThresholdPercent }
                : b,
            ),
          );
        } else {
          setBudgets((prev) => [
            ...prev,
            {
              id: `demo_bgt_${Date.now()}`,
              ownerId: 'demo-user',
              ...input,
            },
          ]);
        }
        pushToast('success', `Saved budget for ${input.category}.`);
        return;
      }
      if (!user) return;
      await fsUpsertBudget(user.uid, existingId, input);
      pushToast('success', `Saved budget for ${input.category}.`);
    },
    [isDemoMode, user, pushToast],
  );

  const removeBudget = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        pushToast('info', 'Category budget removed.');
        return;
      }
      if (!user) return;
      await fsDeleteBudget(user.uid, id);
      pushToast('info', 'Category budget removed.');
    },
    [isDemoMode, user, pushToast],
  );

  const addRecurringBill = useCallback(
    async (input: SanitizedRecurringInput) => {
      if (isDemoMode) {
        setRecurringBills((prev) => [
          ...prev,
          {
            id: `demo_rec_${Date.now()}`,
            ownerId: 'demo-user',
            ...input,
          },
        ]);
        pushToast('success', `Scheduled "${input.title}".`);
        return;
      }
      if (!user) return;
      await fsCreateRecurring(user.uid, input);
      pushToast('success', `Scheduled "${input.title}".`);
    },
    [isDemoMode, user, pushToast],
  );

  const editRecurringBill = useCallback(
    async (id: string, input: SanitizedRecurringInput) => {
      if (isDemoMode) {
        setRecurringBills((prev) => prev.map((r) => (r.id === id ? { ...r, ...input } : r)));
        pushToast('success', `Updated "${input.title}".`);
        return;
      }
      if (!user) return;
      await fsUpdateRecurring(user.uid, id, input);
      pushToast('success', `Updated "${input.title}".`);
    },
    [isDemoMode, user, pushToast],
  );

  const payRecurringBill = useCallback(
    async (bill: RecurringBill) => {
      const paidDate = getTodayDateStr();
      const { convertedAmount, exchangeRate } = convertCurrency(
        bill.amount,
        bill.currency,
        preferences.baseCurrency,
        rates,
        preferences.baseCurrency,
      );
      if (isDemoMode) {
        const nextExpense: Expense = {
          id: `demo_exp_${Date.now()}`,
          ownerId: 'demo-user',
          title: bill.title,
          amount: bill.amount,
          currency: bill.currency,
          exchangeRate,
          convertedAmount,
          category: bill.category,
          date: paidDate,
          monthKey: paidDate.slice(0, 7),
          notes: `Recurring ${bill.cadence} bill payment`,
          recurringId: bill.id,
        };
        setExpenses((prev) => [nextExpense, ...prev]);
        setRecurringBills((prev) =>
          prev.map((r) =>
            r.id === bill.id
              ? {
                  ...r,
                  nextDueDate: advanceRecurringDate(r.nextDueDate, r.cadence),
                  lastPaidDate: paidDate,
                }
              : r,
          ),
        );
        pushToast('success', `Logged "${bill.title}" and advanced next due date.`);
        return;
      }
      if (!user) return;
      await fsMarkRecurringPaid(user.uid, bill, convertedAmount, exchangeRate, paidDate);
      pushToast('success', `Logged "${bill.title}" and updated schedule.`);
    },
    [isDemoMode, user, preferences.baseCurrency, rates, pushToast],
  );

  const removeRecurringBill = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setRecurringBills((prev) => prev.filter((r) => r.id !== id));
        pushToast('info', 'Recurring bill removed.');
        return;
      }
      if (!user) return;
      await fsDeleteRecurring(user.uid, id);
      pushToast('info', 'Recurring bill removed.');
    },
    [isDemoMode, user, pushToast],
  );

  const updatePreferences = useCallback(
    async (updates: {
      baseCurrency: CurrencyCode;
      monthlyBudgetLimit: number;
      themePreference: ThemePreference;
    }) => {
      lastRemoteThemeRef.current = updates.themePreference;
      setThemePreference(updates.themePreference);
      setPreferences((prev) => ({ ...prev, ...updates }));
      if (isDemoMode) {
        pushToast('success', 'Preferences updated.');
        return;
      }
      if (!user) return;
      await fsSavePreferences(user.uid, updates);
      pushToast('success', 'Preferences saved to cloud.');
    },
    [isDemoMode, user, setThemePreference, pushToast],
  );

  const toggleAppTheme = useCallback(async () => {
    const nextTheme: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    lastRemoteThemeRef.current = nextTheme;
    toggleLocalTheme();
    setPreferences((prev) => ({ ...prev, themePreference: nextTheme }));
    if (isDemoMode || !user || !user.emailVerified) {
      return;
    }
    try {
      await fsSavePreferences(user.uid, {
        baseCurrency: preferences.baseCurrency,
        monthlyBudgetLimit: preferences.monthlyBudgetLimit,
        themePreference: nextTheme,
      });
    } catch {
      // Keep local theme applied even if remote sync fails offline
    }
  }, [
    resolvedTheme,
    toggleLocalTheme,
    isDemoMode,
    user,
    preferences.baseCurrency,
    preferences.monthlyBudgetLimit,
  ]);

  const loadSampleHistory = useCallback(async () => {
    if (isDemoMode) {
      const sample = buildSampleDataset('demo-user');
      setExpenses(sample.expenses);
      setBudgets(sample.budgets);
      setRecurringBills(sample.recurringBills);
      setPreferences(sample.preferences);
      pushToast('success', 'Sample 6-month history loaded.');
      return;
    }
    if (!user) return;
    await seedSampleHistoryToCloud(user.uid);
    pushToast('success', 'Loaded 6 months of sample history into your cloud ledger.');
  }, [isDemoMode, user, pushToast]);

  const downloadBackup = useCallback(() => {
    const json = generateBackupJson({
      preferences,
      expenses,
      budgets,
      recurringBills,
    });
    const dateStamp = getTodayDateStr();
    downloadJson(json, `fintrack-backup-${dateStamp}.json`);
    pushToast(
      'success',
      `Downloaded backup (${expenses.length} expenses, ${budgets.length} budgets, ${recurringBills.length} bills).`,
    );
  }, [preferences, expenses, budgets, recurringBills, pushToast]);

  const restoreBackup = useCallback(
    async (rawJson: string) => {
      const parsed = parseAndValidateBackup(rawJson);
      if (!parsed.valid) {
        throw new Error(parsed.error);
      }
      const data = parsed.data;
      lastRemoteThemeRef.current = data.preferences.themePreference;
      setThemePreference(data.preferences.themePreference);

      if (isDemoMode) {
        const suffix = Date.now().toString(36);
        setPreferences({
          ownerId: 'demo-user',
          ...data.preferences,
        });
        setExpenses(
          data.expenses.map((e, i) => ({
            id: `demo_bk_exp_${suffix}_${i}`,
            ownerId: 'demo-user',
            ...e,
          })),
        );
        setBudgets(
          data.budgets.map((b, i) => ({
            id: `demo_bk_bgt_${suffix}_${i}`,
            ownerId: 'demo-user',
            ...b,
          })),
        );
        setRecurringBills(
          data.recurringBills.map((r, i) => ({
            id: `demo_bk_rec_${suffix}_${i}`,
            ownerId: 'demo-user',
            ...r,
          })),
        );
        pushToast(
          'success',
          `Restored ${data.expenses.length} expenses, ${data.budgets.length} budgets, and ${data.recurringBills.length} bills.`,
        );
        return {
          expensesCount: data.expenses.length,
          budgetsCount: data.budgets.length,
          recurringCount: data.recurringBills.length,
        };
      }

      if (!user) {
        throw new Error('Sign in or enter preview mode to restore a backup.');
      }

      await restoreBackupToCloud(user.uid, data);
      pushToast(
        'success',
        `Restored ${data.expenses.length} expenses, ${data.budgets.length} budgets, and ${data.recurringBills.length} bills to cloud ledger.`,
      );
      return {
        expensesCount: data.expenses.length,
        budgetsCount: data.budgets.length,
        recurringCount: data.recurringBills.length,
      };
    },
    [isDemoMode, user, setThemePreference, pushToast],
  );

  const value = useMemo(
    () => ({
      expenses,
      budgets,
      recurringBills,
      preferences,
      rates,
      rateSource,
      syncing,
      syncError,
      toasts,
      dismissToast,
      pushToast,
      addExpense,
      importExpenses,
      editExpense,
      removeExpense,
      saveBudget,
      removeBudget,
      addRecurringBill,
      editRecurringBill,
      payRecurringBill,
      removeRecurringBill,
      updatePreferences,
      toggleAppTheme,
      loadSampleHistory,
      downloadBackup,
      restoreBackup,
    }),
    [
      expenses,
      budgets,
      recurringBills,
      preferences,
      rates,
      rateSource,
      syncing,
      syncError,
      toasts,
      dismissToast,
      pushToast,
      addExpense,
      importExpenses,
      editExpense,
      removeExpense,
      saveBudget,
      removeBudget,
      addRecurringBill,
      editRecurringBill,
      payRecurringBill,
      removeRecurringBill,
      updatePreferences,
      toggleAppTheme,
      loadSampleHistory,
      downloadBackup,
      restoreBackup,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within LedgerProvider');
  return ctx;
}
