import {
  CategoryBudget,
  CurrencyCode,
  Expense,
  MAX_AMOUNT,
  RecurringBill,
  ThemePreference,
  UserPreferences,
} from '../types/expense';
import {
  isValidCurrency,
  SanitizedBudgetInput,
  SanitizedExpenseInput,
  SanitizedRecurringInput,
  validateBudgetInput,
  validateExpenseInput,
  validateRecurringInput,
} from './validation';

const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BACKUP_ITEMS = 5000;

/**
 * Escapes a CSV cell per RFC-4180 and neutralizes spreadsheet formula injection (=, +, -, @).
 */
export function escapeCsvCell(raw: string | number | undefined | null): string {
  let str = raw === undefined || raw === null ? '' : String(raw);
  if (str.length > 0 && FORMULA_INJECTION_PREFIXES.includes(str[0])) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateExpensesCsv(expenses: Expense[], baseCurrency: CurrencyCode): string {
  const headers = [
    'Date',
    'Title',
    'Category',
    'Original Amount',
    'Original Currency',
    'Exchange Rate',
    `Converted Amount (${baseCurrency})`,
    'Notes',
  ];

  const rows = expenses.map((e) => [
    escapeCsvCell(e.date),
    escapeCsvCell(e.title),
    escapeCsvCell(e.category),
    escapeCsvCell(e.amount.toFixed(2)),
    escapeCsvCell(e.currency),
    escapeCsvCell(e.exchangeRate),
    escapeCsvCell(e.convertedAmount.toFixed(2)),
    escapeCsvCell(e.notes),
  ]);

  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeName);
  link.setAttribute('rel', 'noopener');
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  // Defer cleanup and blob URL revocation so Safari, Chrome, and embedded iframes complete the download stream
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 10_000);
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

function toPdfAscii(text: string): string {
  return text
    .replace(/₹/g, 'INR ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/¥/g, 'JPY ')
    .replace(/—/g, '-')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(text: string): string {
  return toPdfAscii(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatPdfMoney(amount: number, currency: CurrencyCode): string {
  const decimals = currency === 'JPY' ? 0 : 2;
  const formatted = (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currency} ${formatted}`;
}

function truncateText(text: string, maxLen: number): string {
  const clean = toPdfAscii(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 3))}...`;
}

export interface PdfReportOptions {
  expenses: Expense[];
  baseCurrency: CurrencyCode;
  scopeLabel: string;
  referenceMonthLabel: string;
  topCategoryLabel: string;
}

/**
 * Generates a spec-compliant multi-page PDF 1.4 binary report without external dependencies
 * so PDF downloads work reliably across desktop, mobile, and sandboxed preview iframes.
 */
export function generateExpensesPdfBytes(opts: PdfReportOptions): Uint8Array {
  const { expenses, baseCurrency, scopeLabel, referenceMonthLabel, topCategoryLabel } = opts;
  const totalBase = Math.round(expenses.reduce((s, e) => s + e.convertedAmount, 0) * 100) / 100;
  const largest =
    expenses.length > 0
      ? expenses.reduce((m, c) => (c.convertedAmount > m.convertedAmount ? c : m))
      : null;

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const rowsFirstPage = 27;
  const rowsNextPage = 36;

  const pageChunks: Expense[][] = [];
  if (expenses.length === 0) {
    pageChunks.push([]);
  } else {
    pageChunks.push(expenses.slice(0, rowsFirstPage));
    for (let i = rowsFirstPage; i < expenses.length; i += rowsNextPage) {
      pageChunks.push(expenses.slice(i, i + rowsNextPage));
    }
  }

  const pageStreams: string[] = pageChunks.map((chunk, pageIndex) => {
    const ops: string[] = [];
    const totalPages = pageChunks.length;
    const isFirst = pageIndex === 0;

    // Header banner bar
    ops.push('0.059 0.090 0.165 rg');
    ops.push(`0 ${pageHeight - 62} ${pageWidth} 62 re f`);

    ops.push('1 1 1 rg');
    ops.push('BT /F2 15 Tf 40 755 Td (FinTrack Expense Report) Tj ET');
    ops.push(
      `BT /F1 8.5 Tf 40 739 Td (${escapePdfText(
        `Scope: ${scopeLabel} | Reference: ${referenceMonthLabel} | Base: ${baseCurrency} | Generated: ${new Date().toISOString().slice(0, 10)}`,
      )}) Tj ET`,
    );

    let y = 708;

    if (isFirst) {
      // Summary strip box
      ops.push('0.965 0.973 0.988 rg');
      ops.push(`${margin} ${y - 46} ${pageWidth - margin * 2} 50 re f`);
      ops.push('0.85 0.88 0.92 RG 0.7 w');
      ops.push(`${margin} ${y - 46} ${pageWidth - margin * 2} 50 re S`);

      ops.push('0.39 0.45 0.55 rg');
      ops.push('BT /F1 8 Tf 52 695 Td (REPORT TOTAL) Tj ET');
      ops.push('BT /F1 8 Tf 190 695 Td (ENTRIES) Tj ET');
      ops.push('BT /F1 8 Tf 290 695 Td (TOP CATEGORY) Tj ET');
      ops.push('BT /F1 8 Tf 440 695 Td (LARGEST EXPENSE) Tj ET');

      ops.push('0.059 0.090 0.165 rg');
      ops.push(`BT /F2 11 Tf 52 678 Td (${escapePdfText(formatPdfMoney(totalBase, baseCurrency))}) Tj ET`);
      ops.push(`BT /F2 11 Tf 190 678 Td (${expenses.length}) Tj ET`);
      ops.push(`BT /F2 9.5 Tf 290 678 Td (${escapePdfText(truncateText(topCategoryLabel || '-', 22))}) Tj ET`);
      ops.push(
        `BT /F2 9.5 Tf 440 678 Td (${escapePdfText(
          largest ? truncateText(formatPdfMoney(largest.convertedAmount, baseCurrency), 22) : '-',
        )}) Tj ET`,
      );

      y = 638;
    }

    // Table Header Bar
    ops.push('0.93 0.95 0.97 rg');
    ops.push(`${margin} ${y - 6} ${pageWidth - margin * 2} 20 re f`);
    ops.push('0.20 0.25 0.33 rg');
    ops.push(`BT /F2 8.5 Tf 46 ${y} Td (Date) Tj ET`);
    ops.push(`BT /F2 8.5 Tf 114 ${y} Td (Description) Tj ET`);
    ops.push(`BT /F2 8.5 Tf 294 ${y} Td (Category) Tj ET`);
    ops.push(`BT /F2 8.5 Tf 402 ${y} Td (Original) Tj ET`);
    ops.push(`BT /F2 8.5 Tf 488 ${y} Td (${escapePdfText(`Converted (${baseCurrency})`)}) Tj ET`);

    y -= 22;

    if (chunk.length === 0) {
      ops.push('0.39 0.45 0.55 rg');
      ops.push(`BT /F1 10 Tf 46 ${y - 10} Td (No expenses match the selected filters.) Tj ET`);
    } else {
      chunk.forEach((exp, idx) => {
        if (idx % 2 === 1) {
          ops.push('0.98 0.985 0.992 rg');
          ops.push(`${margin} ${y - 4} ${pageWidth - margin * 2} 17 re f`);
        }
        ops.push('0.08 0.11 0.18 rg');
        ops.push(`BT /F3 8 Tf 46 ${y} Td (${escapePdfText(exp.date)}) Tj ET`);
        ops.push(`BT /F1 8.5 Tf 114 ${y} Td (${escapePdfText(truncateText(exp.title, 30))}) Tj ET`);
        ops.push(`BT /F1 8 Tf 294 ${y} Td (${escapePdfText(truncateText(exp.category, 18))}) Tj ET`);
        const origStr =
          exp.currency !== baseCurrency ? formatPdfMoney(exp.amount, exp.currency) : '-';
        ops.push(`BT /F3 8 Tf 402 ${y} Td (${escapePdfText(truncateText(origStr, 14))}) Tj ET`);
        ops.push(
          `BT /F3 8.5 Tf 488 ${y} Td (${escapePdfText(
            truncateText(formatPdfMoney(exp.convertedAmount, baseCurrency), 15),
          )}) Tj ET`,
        );

        ops.push('0.91 0.93 0.96 RG 0.4 w');
        ops.push(`${margin} ${y - 4} m ${pageWidth - margin} ${y - 4} l S`);
        y -= 17;
      });
    }

    // Footer
    ops.push('0.45 0.50 0.58 rg');
    ops.push(
      `BT /F1 8 Tf 40 26 Td (FinTrack Open-Source Personal Ledger) Tj ET`,
    );
    ops.push(
      `BT /F1 8 Tf ${pageWidth - 96} 26 Td (Page ${pageIndex + 1} of ${totalPages}) Tj ET`,
    );

    return ops.join('\n');
  });

  // Assemble PDF objects and compute exact byte offsets
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let bytePos = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    parts.push(bytes);
    bytePos += bytes.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const firstPageObjId = 6;
  const pageObjIds = pageStreams.map((_, idx) => firstPageObjId + idx * 2);

  const addObject = (id: number, body: string) => {
    offsets[id] = bytePos;
    pushStr(`${id} 0 obj\n${body}\nendobj\n`);
  };

  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(
    2,
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`,
  );
  addObject(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  addObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  pageStreams.forEach((streamText, idx) => {
    const pageId = firstPageObjId + idx * 2;
    const contentId = pageId + 1;
    const streamBytes = encoder.encode(streamText);

    addObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );

    offsets[contentId] = bytePos;
    pushStr(`${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    parts.push(streamBytes);
    bytePos += streamBytes.length;
    pushStr('\nendstream\nendobj\n');
  });

  const xrefOffset = bytePos;
  const totalObjects = offsets.length;
  pushStr(`xref\n0 ${totalObjects}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id < totalObjects; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const output = new Uint8Array(bytePos);
  let cursor = 0;
  for (const chunk of parts) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export function downloadExpensesPdf(opts: PdfReportOptions, filename: string): void {
  const bytes = generateExpensesPdfBytes(opts);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  triggerBlobDownload(blob, filename);
}

export interface FinTrackBackupPayload {
  app: 'FinTrack';
  version: 1;
  exportedAt: string;
  preferences: {
    baseCurrency: CurrencyCode;
    monthlyBudgetLimit: number;
    themePreference: ThemePreference;
  };
  expenses: SanitizedExpenseInput[];
  budgets: SanitizedBudgetInput[];
  recurringBills: SanitizedRecurringInput[];
}

export function generateBackupJson(input: {
  preferences: UserPreferences;
  expenses: Expense[];
  budgets: CategoryBudget[];
  recurringBills: RecurringBill[];
}): string {
  const payload: FinTrackBackupPayload = {
    app: 'FinTrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: {
      baseCurrency: input.preferences.baseCurrency,
      monthlyBudgetLimit: input.preferences.monthlyBudgetLimit,
      themePreference: input.preferences.themePreference,
    },
    expenses: input.expenses.map((e) => ({
      title: e.title,
      amount: e.amount,
      currency: e.currency,
      exchangeRate: e.exchangeRate,
      convertedAmount: e.convertedAmount,
      category: e.category,
      date: e.date,
      monthKey: e.monthKey,
      notes: e.notes || '',
      ...(e.recurringId ? { recurringId: e.recurringId } : {}),
    })),
    budgets: input.budgets.map((b) => ({
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      alertThresholdPercent: b.alertThresholdPercent,
    })),
    recurringBills: input.recurringBills.map((r) => ({
      title: r.title,
      amount: r.amount,
      currency: r.currency,
      category: r.category,
      cadence: r.cadence,
      nextDueDate: r.nextDueDate,
      autoRemind: r.autoRemind,
      lastPaidDate: r.lastPaidDate || '',
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJson(jsonContent: string, filename: string): void {
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

export function parseAndValidateBackup(
  rawText: string,
): { valid: true; data: FinTrackBackupPayload } | { valid: false; error: string } {
  if (!rawText || rawText.length > MAX_BACKUP_FILE_BYTES) {
    return { valid: false, error: 'Backup file is empty or exceeds the 5 MB safety limit.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, error: 'Invalid JSON file format.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Backup root must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.app !== 'FinTrack' || obj.version !== 1) {
    return { valid: false, error: 'Unrecognized backup format. Expected FinTrack v1 JSON backup.' };
  }

  const rawExpenses = Array.isArray(obj.expenses) ? obj.expenses : [];
  const rawBudgets = Array.isArray(obj.budgets) ? obj.budgets : [];
  const rawRecurring = Array.isArray(obj.recurringBills) ? obj.recurringBills : [];

  if (rawExpenses.length + rawBudgets.length + rawRecurring.length > MAX_BACKUP_ITEMS) {
    return { valid: false, error: 'Backup contains too many records (limit 5,000).' };
  }

  const expenses: SanitizedExpenseInput[] = [];
  for (let i = 0; i < rawExpenses.length; i++) {
    const item = rawExpenses[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Invalid expense entry at index ${i}.` };
    }
    const check = validateExpenseInput({
      title: String(item.title ?? ''),
      amount: typeof item.amount === 'number' || typeof item.amount === 'string' ? item.amount : '',
      currency: String(item.currency ?? ''),
      exchangeRate:
        typeof item.exchangeRate === 'number' || typeof item.exchangeRate === 'string'
          ? item.exchangeRate
          : 1,
      category: String(item.category ?? ''),
      date: String(item.date ?? ''),
      notes: typeof item.notes === 'string' ? item.notes : '',
      recurringId: typeof item.recurringId === 'string' ? item.recurringId : undefined,
    });
    if (!check.valid || !check.sanitized) {
      return { valid: false, error: `Invalid expense entry at row ${i + 1}.` };
    }
    expenses.push(check.sanitized);
  }

  const budgets: SanitizedBudgetInput[] = [];
  for (let i = 0; i < rawBudgets.length; i++) {
    const item = rawBudgets[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Invalid budget entry at index ${i}.` };
    }
    const check = validateBudgetInput({
      category: String(item.category ?? ''),
      monthlyLimit:
        typeof item.monthlyLimit === 'number' || typeof item.monthlyLimit === 'string'
          ? item.monthlyLimit
          : '',
      alertThresholdPercent:
        typeof item.alertThresholdPercent === 'number' || typeof item.alertThresholdPercent === 'string'
          ? item.alertThresholdPercent
          : 80,
    });
    if (!check.valid || !check.sanitized) {
      return { valid: false, error: `Invalid budget entry at row ${i + 1}.` };
    }
    budgets.push(check.sanitized);
  }

  const recurringBills: SanitizedRecurringInput[] = [];
  for (let i = 0; i < rawRecurring.length; i++) {
    const item = rawRecurring[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Invalid recurring bill entry at index ${i}.` };
    }
    const check = validateRecurringInput({
      title: String(item.title ?? ''),
      amount: typeof item.amount === 'number' || typeof item.amount === 'string' ? item.amount : '',
      currency: String(item.currency ?? ''),
      category: String(item.category ?? ''),
      cadence: String(item.cadence ?? ''),
      nextDueDate: String(item.nextDueDate ?? ''),
      autoRemind: Boolean(item.autoRemind ?? true),
      lastPaidDate: typeof item.lastPaidDate === 'string' ? item.lastPaidDate : '',
    });
    if (!check.valid || !check.sanitized) {
      return { valid: false, error: `Invalid recurring bill entry at row ${i + 1}.` };
    }
    recurringBills.push(check.sanitized);
  }

  const rawPrefs = (obj.preferences && typeof obj.preferences === 'object'
    ? obj.preferences
    : {}) as Record<string, unknown>;
  const baseCurrencyRaw = String(rawPrefs.baseCurrency ?? 'INR');
  const baseCurrency: CurrencyCode = isValidCurrency(baseCurrencyRaw) ? baseCurrencyRaw : 'INR';
  const rawLimit = Number(rawPrefs.monthlyBudgetLimit ?? 0);
  const monthlyBudgetLimit =
    Number.isFinite(rawLimit) && rawLimit >= 0 && rawLimit <= MAX_AMOUNT
      ? Math.round(rawLimit * 100) / 100
      : 0;
  const rawTheme = String(rawPrefs.themePreference ?? 'system');
  const themePreference: ThemePreference =
    rawTheme === 'light' || rawTheme === 'dark' || rawTheme === 'system' ? rawTheme : 'system';

  return {
    valid: true,
    data: {
      app: 'FinTrack',
      version: 1,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
      preferences: {
        baseCurrency,
        monthlyBudgetLimit,
        themePreference,
      },
      expenses,
      budgets,
      recurringBills,
    },
  };
}
