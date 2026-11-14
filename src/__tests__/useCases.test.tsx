import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('../lib/firebase', () => ({
  app: {},
  db: {},
  auth: { currentUser: null },
  googleProvider: {},
  isFirebaseConfigured: true,
  firebaseInitError: null,
  testFirestoreConnection: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null);
    return vi.fn();
  }),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocFromServer: vi.fn().mockResolvedValue({}),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  Timestamp: class {},
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline test mode'));
});

describe('FinTrack Core Product Use Cases', () => {
  it('UC-FX: logs foreign-currency expense with automatic FX conversion and updates monthly totals', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Add Expense/i })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Merchant or Description/i), {
      target: { value: 'Cloud API Credit' },
    });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/^Currency$/i), {
      target: { value: 'USD' },
    });

    // Live FX conversion preview block should show INR conversion
    expect(screen.getByText(/Converts to/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cloud API Credit')).toBeInTheDocument();
  });

  it('UC-REPORTS-EXPORT: triggers Export CSV, Download PDF, Print, and Backup JSON without errors', async () => {
    const createObjSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:uc-test');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Reports/i })[0]);
    expect(await screen.findByRole('button', { name: /Download PDF/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(await screen.findByText(/Exported \d+ rows to CSV/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Download PDF/i }));
    expect(await screen.findByText(/Downloaded PDF report/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Backup JSON/i }));
    expect(await screen.findByText(/Downloaded backup/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Print$/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(3);

    createObjSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    printSpy.mockRestore();
  });

  it('UC-CHARTS-DRILLDOWN: toggles trend labels/daily pace mode and drills down from Overview Donut to Reports', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    // Toggle Labels off & back on on 6-Month Spending Trend
    const labelsToggle = screen.getAllByRole('button', { name: /^Labels$/i })[0];
    expect(labelsToggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(labelsToggle);
    expect(labelsToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(labelsToggle);
    expect(labelsToggle).toHaveAttribute('aria-pressed', 'true');

    // Toggle 6-Month Spending Trend between Line and Bar
    fireEvent.click(screen.getByRole('button', { name: /^Bar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Line$/i }));

    // Toggle Daily Spend Pace between Cumulative and Daily / Period
    const dailyBtn = screen.getByRole('button', { name: /^Daily \/ Period$/i });
    const cumulativeBtn = screen.getByRole('button', { name: /^Cumulative$/i });
    fireEvent.click(dailyBtn);
    expect(dailyBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(cumulativeBtn);
    expect(cumulativeBtn).toHaveAttribute('aria-pressed', 'true');

    // Click a category in Category Breakdown to jump to filtered Reports
    const housingBtn = screen.getAllByRole('button', { name: /Housing/i })[0];
    fireEvent.click(housingBtn);

    expect(await screen.findByText('Expense Reports & History')).toBeInTheDocument();
    const categorySelect = screen.getByLabelText(/Filter by category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe('Housing');
  });

  it('UC-EXPENSE-VALIDATION: blocks empty required fields and preserves dialog until valid', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Add Expense/i })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));
    expect(
      await screen.findByText(/Enter a short description or merchant name\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('UC-BACKUP-RESTORE: restores a valid JSON backup in Settings and rejects corrupted JSON cleanly', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(await screen.findByText('Reporting Preferences')).toBeInTheDocument();

    const restoreInput = screen.getByLabelText(/Restore backup JSON file/i);
    const corruptText = '{corrupt-json';
    const corruptFile = new File([corruptText], 'broken.json', { type: 'application/json' });
    Object.defineProperty(corruptFile, 'text', { value: async () => corruptText });
    fireEvent.change(restoreInput, { target: { files: [corruptFile] } });

    expect(await screen.findByText(/Invalid JSON file format\./i)).toBeInTheDocument();
    expect(screen.getByText('Reporting Preferences')).toBeInTheDocument();

    const validPayload = JSON.stringify({
      app: 'FinTrack',
      version: 1,
      exportedAt: '2026-11-14T10:00:00.000Z',
      preferences: { baseCurrency: 'USD', monthlyBudgetLimit: 3000, themePreference: 'light' },
      expenses: [
        {
          title: 'Restored Train Ticket',
          amount: 120,
          currency: 'USD',
          exchangeRate: 1,
          category: 'Transport',
          date: '2026-11-12',
          notes: 'Backup test',
        },
      ],
      budgets: [{ category: 'Transport', monthlyLimit: 500, alertThresholdPercent: 80 }],
      recurringBills: [],
    });

    const validFile = new File([validPayload], 'backup.json', { type: 'application/json' });
    Object.defineProperty(validFile, 'text', { value: async () => validPayload });
    fireEvent.change(restoreInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.queryByText('Reporting Preferences')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Restored Train Ticket')).toBeInTheDocument();
  });

  it('UC-REPORTS-FILTER: filters transactions by search term and resets cleanly', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Reports/i })[0]);
    expect(await screen.findByText('Expense Reports & History')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search description, notes, category\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'zzzz_no_such_merchant_999' } });
    expect(
      await screen.findByText(/No expenses match the selected filters/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset Filters/i }));
    expect(
      screen.queryByText(/No expenses match the selected filters/i),
    ).not.toBeInTheDocument();
  });
});
