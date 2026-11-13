import { CurrencyCode, Expense } from '../types/expense';

const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

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

export function downloadCsv(csvContent: string, filename: string): void {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
