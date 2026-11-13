import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline test mode'));
});

// Mock Firebase SDK modules so UI & workflow integration tests run offline hermetically
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

describe('FinTrack interactive flows, theme switching, CRUD operations, charts & navigation', () => {
  it('renders FinTrack branding, Email and Google authentication options, and switches light <-> dark cleanly', () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    render(<App />);

    expect(screen.getByText('FinTrack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();

    const themeBtn = screen.getByRole('button', { name: /Toggle color theme/i });
    // Light -> Dark
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // Dark -> Light
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('launches Demo Mode, supports bidirectional theme toggle, Settings, and full CRUD across Expenses, Budgets, and Recurring Bills', async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    render(<App />);

    // Enter Demo Mode
    fireEvent.click(screen.getByRole('button', { name: /Explore 6-Month Sample Ledger/i }));

    // Overview KPI & visualizations appear with INR default
    expect(await screen.findByText('Financial Overview')).toBeInTheDocument();
    expect(screen.getByText('6-Month Spending Trend')).toBeInTheDocument();
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument();

    // Toggle Dark -> Light -> Dark inside main dashboard shell
    const sidebarThemeBtn = screen.getByRole('button', { name: /Toggle dark mode/i });
    fireEvent.click(sidebarThemeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(sidebarThemeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(sidebarThemeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Verify Settings modal reflects current Dark theme and allows switching back to Light
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(await screen.findByText('Reporting Preferences')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));
    await waitFor(() => {
      expect(screen.queryByText('Reporting Preferences')).not.toBeInTheDocument();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 1. CREATE Expense (with validation check)
    const addButtons = screen.getAllByRole('button', { name: /Add Expense/i });
    fireEvent.click(addButtons[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));
    expect(screen.getByText(/Enter a short description/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Merchant or Description/i), {
      target: { value: 'Vitest Coffee Roasters' },
    });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), {
      target: { value: '450' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Expense/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Vitest Coffee Roasters')).toBeInTheDocument();

    // 2. UPDATE Expense via modal
    fireEvent.click(screen.getByRole('button', { name: /Edit Vitest Coffee Roasters/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Merchant or Description/i), {
      target: { value: 'Vitest Espresso Bar' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Vitest Espresso Bar')).toBeInTheDocument();

    // 3. Navigate to Reports & verify filtering + CSV export + DELETE Expense (2-step inline)
    fireEvent.click(screen.getAllByRole('button', { name: /Reports/i })[0]);
    expect(await screen.findByRole('button', { name: /Export CSV/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Search expenses/i), {
      target: { value: 'Vitest Espresso' },
    });
    expect(screen.getAllByText('Vitest Espresso Bar').length).toBeGreaterThan(0);

    const deleteExpenseBtns = screen.getAllByRole('button', { name: /Delete Vitest Espresso Bar/i });
    fireEvent.click(deleteExpenseBtns[0]);
    const confirmDeleteBtns = screen.getAllByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmDeleteBtns[0]);

    await waitFor(() => {
      expect(screen.queryByText('Vitest Espresso Bar')).not.toBeInTheDocument();
    });

    // 4. Navigate to Budgets, toggle Dark mode, update Overall Cap (verify Dark stays active!), Clear Cap, and test Category Budget CRUD
    fireEvent.click(screen.getAllByRole('button', { name: /Budgets/i })[0]);
    expect(await screen.findByText(/Set Category Budget Limit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/On Track|Approaching Limit|Over Budget/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Toggle dark mode/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Overall monthly cap/i), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Cap/i }));
    expect(await screen.findByText(/Preferences updated/i)).toBeInTheDocument();
    // Updating budget cap must NOT revert dark mode
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Clear Cap/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Clear Cap/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Food & Dining budget/i }));
    const editLimitInput = screen.getByLabelText(/Edit Food & Dining limit/i);
    fireEvent.change(editLimitInput, { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Food & Dining budget/i }));
    expect(await screen.findByText(/Saved budget for Food & Dining/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove Food & Dining budget/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    expect(await screen.findByText(/Category budget removed/i)).toBeInTheDocument();

    // 5. Navigate to Recurring Bills & test Pay & Log + EDIT modal + 2-step DELETE
    fireEvent.click(screen.getAllByRole('button', { name: /Recurring/i })[0]);
    expect(await screen.findByText(/Schedule Recurring Bill/i)).toBeInTheDocument();
    const payButtons = await screen.findAllByRole('button', { name: /Pay & Log/i });
    expect(payButtons.length).toBeGreaterThan(0);
    fireEvent.click(payButtons[0]);
    expect(await screen.findByText(/advanced next due date/i)).toBeInTheDocument();

    const editBillButtons = screen.getAllByRole('button', { name: /^Edit /i });
    fireEvent.click(editBillButtons[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Bill Name/i, { selector: '#edit-rec-title' }), {
      target: { value: 'Updated Fiber Bill' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Updated Fiber Bill')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete Updated Fiber Bill/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await waitFor(() => {
      expect(screen.queryByText('Updated Fiber Bill')).not.toBeInTheDocument();
    });
  }, 15000);

  it('renders ErrorBoundary recovery screen instead of a blank page when a child throws', async () => {
    const { ErrorBoundary } = await import('../components/ErrorBoundary');
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BrokenChild = () => {
      throw new Error('Simulated unexpected render failure');
    };

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Simulated unexpected render failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload FinTrack/i })).toBeInTheDocument();
    consoleErrSpy.mockRestore();
  });
});
