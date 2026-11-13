import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Moon,
  PiggyBank,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BackdropAtmosphere } from './components/BackdropAtmosphere';
import { ExpenseModal } from './components/modals/ExpenseModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { BudgetsView } from './components/views/BudgetsView';
import { OverviewView } from './components/views/OverviewView';
import { RecurringView } from './components/views/RecurringView';
import { ReportsView } from './components/views/ReportsView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LedgerProvider, useLedger } from './contexts/LedgerContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import {
  collectAvailableMonths,
  formatMonthLabel,
  getCurrentMonthKey,
  shiftMonthKey,
} from './lib/analytics';
import { Expense, ExpenseCategory } from './types/expense';

type ActiveTab = 'overview' | 'reports' | 'budgets' | 'recurring';

function LedgerShell() {
  const { user, loading, isDemoMode, signOut, exitDemoMode } = useAuth();
  const { resolvedTheme } = useTheme();
  const { expenses, preferences, syncError, toasts, dismissToast, toggleAppTheme } = useLedger();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [reportCategoryFilter, setReportCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090E1A]">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Connecting to FinTrack...
        </div>
      </div>
    );
  }

  // Require authenticated + verified user OR explicit Demo Mode
  if (!isDemoMode && (!user || !user.emailVerified)) {
    return <AuthScreen />;
  }

  const availableMonths = collectAvailableMonths(expenses, getCurrentMonthKey());

  const openAddModal = () => {
    setEditingExpense(null);
    setExpenseModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseModalOpen(true);
  };

  const handleOpenReports = (cat?: ExpenseCategory) => {
    setReportCategoryFilter(cat || 'All');
    setActiveTab('reports');
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'budgets', label: 'Budgets', icon: PiggyBank },
    { id: 'recurring', label: 'Recurring', icon: CalendarClock },
  ];

  const accountLabel = isDemoMode
    ? 'Sample Preview Mode'
    : user?.displayName || user?.email || 'Cloud Account';

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-[#090E1A] text-slate-900 dark:text-slate-100">
      <BackdropAtmosphere />

      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:fixed lg:inset-y-0 z-20 border-r border-slate-200/90 dark:border-slate-800/90 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="text-lg font-bold font-display tracking-tight whitespace-nowrap">
              FinTrack
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'reports') setReportCategoryFilter('All');
                  setActiveTab(item.id);
                }}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
              {accountLabel}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isDemoMode
                ? 'Local only · Sign in for cloud sync'
                : `Synced · ${preferences.baseCurrency} base`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => void toggleAppTheme()}
              aria-label="Toggle dark mode"
              className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => (isDemoMode ? exitDemoMode() : signOut())}
              aria-label={isDemoMode ? 'Exit preview mode' : 'Sign out'}
              className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="relative z-10 flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Compact 52px on mobile, 64px on desktop) */}
        <header className="no-print sticky top-0 z-30 h-13 lg:h-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden text-base font-bold font-display tracking-tight whitespace-nowrap">
              FinTrack
            </span>

            {/* Month Navigator */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1 py-0.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setActiveMonthKey((m) => shiftMonthKey(m, -1))}
                className="min-w-[32px] min-h-[32px] lg:min-w-[36px] lg:min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                aria-label="Select reporting month"
                value={activeMonthKey}
                onChange={(e) => setActiveMonthKey(e.target.value)}
                className="bg-transparent text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 px-1 focus:outline-none cursor-pointer"
              >
                {availableMonths.includes(activeMonthKey) ? null : (
                  <option value={activeMonthKey}>{formatMonthLabel(activeMonthKey)}</option>
                )}
                {availableMonths.map((mk) => (
                  <option key={mk} value={mk} className="bg-white dark:bg-slate-900">
                    {formatMonthLabel(mk)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setActiveMonthKey((m) => shiftMonthKey(m, 1))}
                className="min-w-[32px] min-h-[32px] lg:min-w-[36px] lg:min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void toggleAppTheme()}
              aria-label="Toggle theme"
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="hidden sm:inline-flex min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        </header>

        {/* Demo Mode Callout Banner */}
        {isDemoMode && (
          <div className="no-print bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/70 px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-blue-900 dark:text-blue-200">
              You are viewing local sample data. Sign in to sync your own expenses across mobile
              and desktop browsers.
            </span>
            <button
              type="button"
              onClick={exitDemoMode}
              className="font-semibold text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap"
            >
              Sign in for Cloud Sync
            </button>
          </div>
        )}

        {/* Sync Error Alert */}
        {syncError && (
          <div
            role="alert"
            className="no-print m-4 sm:mx-6 lg:mx-8 mb-0 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300"
          >
            Cloud sync issue: {syncError}
          </div>
        )}

        {/* Active Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          <div className="no-print mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeTab === 'overview' && 'Financial Overview'}
                {activeTab === 'reports' && 'Expense Reports & History'}
                {activeTab === 'budgets' && 'Budgets & Threshold Alerts'}
                {activeTab === 'recurring' && 'Recurring Bills & Schedules'}
              </h1>
            </div>
            {isDemoMode && (
              <button
                type="button"
                onClick={exitDemoMode}
                className="lg:hidden text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400"
              >
                Exit Preview
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'overview' && (
                <OverviewView
                  activeMonthKey={activeMonthKey}
                  onSelectMonth={(mk) => setActiveMonthKey(mk)}
                  onAddExpense={openAddModal}
                  onEditExpense={openEditModal}
                  onOpenReports={handleOpenReports}
                  onOpenBudgets={() => setActiveTab('budgets')}
                  onOpenRecurring={() => setActiveTab('recurring')}
                />
              )}
              {activeTab === 'reports' && (
                <ReportsView
                  activeMonthKey={activeMonthKey}
                  initialCategoryFilter={reportCategoryFilter}
                  onEditExpense={openEditModal}
                />
              )}
              {activeTab === 'budgets' && <BudgetsView activeMonthKey={activeMonthKey} />}
              {activeTab === 'recurring' && <RecurringView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Fixed Bottom Thumb Navigation Bar (60px height, >=44px hitboxes) */}
      <nav
        aria-label="Mobile Navigation"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-15 px-1">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'reports') setReportCategoryFilter('All');
                  setActiveTab(item.id);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={openAddModal}
              aria-label="Add expense"
              className="w-12 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="no-print fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`pointer-events-auto rounded-xl px-4 py-3 text-xs font-medium shadow-lg border flex items-center justify-between gap-3 ${
                t.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : t.type === 'success'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="opacity-70 hover:opacity-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <ExpenseModal
        open={expenseModalOpen}
        editingExpense={editingExpense}
        onClose={() => setExpenseModalOpen(false)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LedgerProvider>
          <LedgerShell />
        </LedgerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
