import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { advanceRecurringDate } from '../lib/analytics';
import { buildSampleDataset } from '../lib/demoData';
import { auth, db } from '../lib/firebase';
import {
  SanitizedBudgetInput,
  SanitizedExpenseInput,
  SanitizedRecurringInput,
} from '../lib/validation';
import {
  CategoryBudget,
  CurrencyCode,
  Expense,
  RecurringBill,
  ThemePreference,
  UserPreferences,
} from '../types/expense';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function generateDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now()}_${rand}`;
}

function formatTimestamp(val: unknown): string | undefined {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  return undefined;
}

export function subscribePreferences(
  userId: string,
  onData: (prefs: UserPreferences | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${userId}/profile/preferences`;
  const ref = doc(db, 'users', userId, 'profile', 'preferences');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        ownerId: d.ownerId,
        baseCurrency: d.baseCurrency as CurrencyCode,
        monthlyBudgetLimit: Number(d.monthlyBudgetLimit) || 0,
        themePreference: (d.themePreference as ThemePreference) || 'system',
        updatedAt: formatTimestamp(d.updatedAt),
      });
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    },
  );
}

export async function savePreferences(
  userId: string,
  updates: {
    baseCurrency: CurrencyCode;
    monthlyBudgetLimit: number;
    themePreference: ThemePreference;
  },
): Promise<void> {
  const path = `users/${userId}/profile/preferences`;
  const ref = doc(db, 'users', userId, 'profile', 'preferences');
  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerId: userId,
        baseCurrency: updates.baseCurrency,
        monthlyBudgetLimit: updates.monthlyBudgetLimit,
        themePreference: updates.themePreference,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        baseCurrency: updates.baseCurrency,
        monthlyBudgetLimit: updates.monthlyBudgetLimit,
        themePreference: updates.themePreference,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeExpenses(
  userId: string,
  onData: (expenses: Expense[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${userId}/expenses`;
  const q = query(collection(db, 'users', userId, 'expenses'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Expense[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId,
          title: d.title,
          amount: Number(d.amount),
          currency: d.currency,
          exchangeRate: Number(d.exchangeRate),
          convertedAmount: Number(d.convertedAmount),
          category: d.category,
          date: d.date,
          monthKey: d.monthKey,
          notes: d.notes || '',
          ...(d.recurringId ? { recurringId: d.recurringId } : {}),
          createdAt: formatTimestamp(d.createdAt),
          updatedAt: formatTimestamp(d.updatedAt),
        };
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    },
  );
}

export async function createExpense(userId: string, input: SanitizedExpenseInput): Promise<string> {
  const id = generateDocId('exp');
  const path = `users/${userId}/expenses/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'expenses', id), {
      ownerId: userId,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      convertedAmount: input.convertedAmount,
      category: input.category,
      date: input.date,
      monthKey: input.monthKey,
      notes: input.notes,
      ...(input.recurringId ? { recurringId: input.recurringId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateExpense(
  userId: string,
  expenseId: string,
  input: SanitizedExpenseInput,
): Promise<void> {
  const path = `users/${userId}/expenses/${expenseId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'expenses', expenseId), {
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      convertedAmount: input.convertedAmount,
      category: input.category,
      date: input.date,
      monthKey: input.monthKey,
      notes: input.notes,
      ...(input.recurringId ? { recurringId: input.recurringId } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  const path = `users/${userId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'expenses', expenseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeBudgets(
  userId: string,
  onData: (budgets: CategoryBudget[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${userId}/budgets`;
  const q = query(collection(db, 'users', userId, 'budgets'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items: CategoryBudget[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId,
          category: d.category,
          monthlyLimit: Number(d.monthlyLimit),
          alertThresholdPercent: Number(d.alertThresholdPercent),
          createdAt: formatTimestamp(d.createdAt),
          updatedAt: formatTimestamp(d.updatedAt),
        };
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    },
  );
}

export async function upsertBudget(
  userId: string,
  existingBudgetId: string | null,
  input: SanitizedBudgetInput,
): Promise<string> {
  const id = existingBudgetId || generateDocId('bgt');
  const path = `users/${userId}/budgets/${id}`;
  try {
    if (existingBudgetId) {
      await updateDoc(doc(db, 'users', userId, 'budgets', id), {
        monthlyLimit: input.monthlyLimit,
        alertThresholdPercent: input.alertThresholdPercent,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', userId, 'budgets', id), {
        ownerId: userId,
        category: input.category,
        monthlyLimit: input.monthlyLimit,
        alertThresholdPercent: input.alertThresholdPercent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, existingBudgetId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const path = `users/${userId}/budgets/${budgetId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'budgets', budgetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeRecurringBills(
  userId: string,
  onData: (bills: RecurringBill[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `users/${userId}/recurring`;
  const q = query(collection(db, 'users', userId, 'recurring'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items: RecurringBill[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ownerId: d.ownerId,
          title: d.title,
          amount: Number(d.amount),
          currency: d.currency,
          category: d.category,
          cadence: d.cadence,
          nextDueDate: d.nextDueDate,
          autoRemind: Boolean(d.autoRemind),
          lastPaidDate: d.lastPaidDate || '',
          createdAt: formatTimestamp(d.createdAt),
          updatedAt: formatTimestamp(d.updatedAt),
        };
      });
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    },
  );
}

export async function createRecurringBill(
  userId: string,
  input: SanitizedRecurringInput,
): Promise<string> {
  const id = generateDocId('rec');
  const path = `users/${userId}/recurring/${id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'recurring', id), {
      ownerId: userId,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      cadence: input.cadence,
      nextDueDate: input.nextDueDate,
      autoRemind: input.autoRemind,
      lastPaidDate: input.lastPaidDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateRecurringBill(
  userId: string,
  billId: string,
  input: SanitizedRecurringInput,
): Promise<void> {
  const path = `users/${userId}/recurring/${billId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'recurring', billId), {
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      cadence: input.cadence,
      nextDueDate: input.nextDueDate,
      autoRemind: input.autoRemind,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markRecurringBillPaid(
  userId: string,
  bill: RecurringBill,
  convertedAmount: number,
  exchangeRate: number,
  paidDate: string,
): Promise<void> {
  const expId = generateDocId('exp');
  const path = `users/${userId}/recurring/${bill.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', userId, 'expenses', expId), {
      ownerId: userId,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', userId, 'recurring', bill.id), {
      nextDueDate: advanceRecurringDate(bill.nextDueDate, bill.cadence),
      lastPaidDate: paidDate,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteRecurringBill(userId: string, billId: string): Promise<void> {
  const path = `users/${userId}/recurring/${billId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'recurring', billId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedSampleHistoryToCloud(userId: string): Promise<void> {
  const sample = buildSampleDataset(userId);
  const path = `users/${userId}/expenses`;
  const seedSuffix = Date.now().toString(36);
  try {
    const prefsRef = doc(db, 'users', userId, 'profile', 'preferences');
    const prefsSnap = await getDoc(prefsRef);
    const batch = writeBatch(db);
    if (!prefsSnap.exists()) {
      batch.set(prefsRef, {
        ownerId: userId,
        baseCurrency: sample.preferences.baseCurrency,
        monthlyBudgetLimit: sample.preferences.monthlyBudgetLimit,
        themePreference: sample.preferences.themePreference,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(prefsRef, {
        baseCurrency: sample.preferences.baseCurrency,
        monthlyBudgetLimit: sample.preferences.monthlyBudgetLimit,
        themePreference: sample.preferences.themePreference,
        updatedAt: serverTimestamp(),
      });
    }
    for (const exp of sample.expenses) {
      batch.set(doc(db, 'users', userId, 'expenses', `${exp.id}_${seedSuffix}`), {
        ownerId: userId,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency,
        exchangeRate: exp.exchangeRate,
        convertedAmount: exp.convertedAmount,
        category: exp.category,
        date: exp.date,
        monthKey: exp.monthKey,
        notes: exp.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const bgt of sample.budgets) {
      batch.set(doc(db, 'users', userId, 'budgets', `${bgt.id}_${seedSuffix}`), {
        ownerId: userId,
        category: bgt.category,
        monthlyLimit: bgt.monthlyLimit,
        alertThresholdPercent: bgt.alertThresholdPercent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const rec of sample.recurringBills) {
      batch.set(doc(db, 'users', userId, 'recurring', `${rec.id}_${seedSuffix}`), {
        ownerId: userId,
        title: rec.title,
        amount: rec.amount,
        currency: rec.currency,
        category: rec.category,
        cadence: rec.cadence,
        nextDueDate: rec.nextDueDate,
        autoRemind: rec.autoRemind,
        lastPaidDate: rec.lastPaidDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
