import { readSheet } from 'read-excel-file/universal';
import {
  CATEGORIES,
  CURRENCIES,
  CURRENCY_META,
  CurrencyCode,
  Expense,
  ExpenseCategory,
} from '../types/expense';
import { convertCurrency } from './currency';
import { isValidCalendarDate, isValidCurrency, SanitizedExpenseInput, validateExpenseInput } from './validation';

export type SpreadsheetCell = string | number | boolean | Date | null | undefined;
export type SpreadsheetRows = SpreadsheetCell[][];

export interface ImportColumnMapping {
  date: number;
  title: number;
  amount: number;
  category: number; // -1 means auto/default
  currency: number; // -1 means use defaultCurrency
  exchangeRate: number; // -1 means auto FX rate
  notes: number; // -1 means empty
}

export interface ImportedExpenseRow {
  rowNumber: number;
  sanitized: SanitizedExpenseInput;
  isDuplicate: boolean;
}

export interface InvalidImportRow {
  rowNumber: number;
  reason: string;
  rawPreview: string;
}

export interface ImportParsePreview {
  validRows: ImportedExpenseRow[];
  invalidRows: InvalidImportRow[];
  duplicateCount: number;
  totalBaseAmount: number;
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_ROWS = 2000;

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function stripFormulaShield(text: string): string {
  const trimmed = text.trim();
  if (/^'[=+\-@]/.test(trimmed)) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function detectCsvDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const delim of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === delim) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return bestCount > 0 ? best : ',';
}

/**
 * RFC-4180 compliant CSV/TSV parser supporting quoted fields, escaped quotes,
 * embedded newlines, UTF-8 BOM, and auto delimiter detection.
 */
export function parseCsvRows(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) return [];

  const delimiter = detectCsvDelimiter(cleaned);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(stripFormulaShield(cell));
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(stripFormulaShield(cell));
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(stripFormulaShield(cell));
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(stripFormulaShield(cell));
  if (row.some((c) => c !== '')) {
    rows.push(row);
  }

  return rows;
}

function parseXmlOrHtmlTableRows(text: string): string[][] {
  if (typeof DOMParser === 'undefined') {
    return [];
  }
  const lower = text.trimStart().toLowerCase();
  const parser = new DOMParser();

  if (lower.includes('<table')) {
    const doc = parser.parseFromString(text, 'text/html');
    const trs = Array.from(doc.querySelectorAll('tr'));
    return trs
      .map((tr) =>
        Array.from(tr.querySelectorAll('th, td')).map((td) =>
          stripFormulaShield(td.textContent || ''),
        ),
      )
      .filter((r) => r.some((c) => c !== ''));
  }

  if (lower.includes('<row') && lower.includes('<cell')) {
    const doc = parser.parseFromString(text, 'application/xml');
    const rowEls = Array.from(doc.getElementsByTagName('Row'));
    return rowEls
      .map((rowEl) =>
        Array.from(rowEl.getElementsByTagName('Cell')).map((cellEl) =>
          stripFormulaShield(cellEl.textContent || ''),
        ),
      )
      .filter((r) => r.some((c) => c !== ''));
  }

  return [];
}

export interface UploadedSpreadsheetFile {
  name: string;
  size?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text?: () => Promise<string>;
}

/**
 * Reads either a CSV/TSV text file or an Excel (.xlsx / SpreadsheetML .xls) file
 * into a uniform 2D array of rows.
 */
export async function readUploadedExpenseSheet(
  file: UploadedSpreadsheetFile,
): Promise<SpreadsheetRows> {
  if (typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
    throw new Error('File exceeds the 5 MB upload limit.');
  }

  const nameLower = file.name.toLowerCase();
  const isCsv =
    nameLower.endsWith('.csv') || nameLower.endsWith('.tsv') || nameLower.endsWith('.txt');
  const isXlsx = nameLower.endsWith('.xlsx');
  const isXls = nameLower.endsWith('.xls');

  if (!isCsv && !isXlsx && !isXls) {
    throw new Error('Unsupported file type. Upload a .csv or .xlsx Excel file.');
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('The selected file is empty.');
  }
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error('File exceeds the 5 MB upload limit.');
  }

  if (isCsv) {
    const rawText = file.text
      ? await file.text()
      : new TextDecoder('utf-8').decode(buffer);
    const rows = parseCsvRows(rawText);
    if (rows.length > MAX_IMPORT_ROWS + 1) {
      throw new Error(`CSV contains more than ${MAX_IMPORT_ROWS} rows. Split into smaller batches.`);
    }
    return rows;
  }

  // Check for ZIP magic bytes (PK..) used by modern .xlsx workbooks
  const headerBytes = new Uint8Array(buffer.slice(0, 4));
  const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;
  const isLegacyOleBinary =
    headerBytes[0] === 0xd0 &&
    headerBytes[1] === 0xcf &&
    headerBytes[2] === 0x11 &&
    headerBytes[3] === 0xe0;

  if (isZip) {
    const sheetRows = await readSheet(buffer);
    const nonEmpty: SpreadsheetRows = sheetRows
      .map((row) =>
        row.map((cell): SpreadsheetCell =>
          cell instanceof Date ||
          typeof cell === 'string' ||
          typeof cell === 'number' ||
          typeof cell === 'boolean'
            ? cell
            : null,
        ),
      )
      .filter((r) =>
        r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''),
      );
    if (nonEmpty.length > MAX_IMPORT_ROWS + 1) {
      throw new Error(`Spreadsheet contains more than ${MAX_IMPORT_ROWS} rows. Split into smaller batches.`);
    }
    return nonEmpty;
  }

  if (isLegacyOleBinary) {
    throw new Error(
      'Legacy binary .xls (Excel 97–2003) files are not supported directly. Save As .xlsx or .csv in Excel or Google Sheets and upload again.',
    );
  }

  // Fallback for bank-exported .xls files that are actually HTML tables, XML SpreadsheetML, or CSV
  const fallbackText = new TextDecoder('utf-8').decode(buffer);
  const trimmed = fallbackText.trimStart();
  if (trimmed.startsWith('<')) {
    const xmlRows = parseXmlOrHtmlTableRows(fallbackText);
    if (xmlRows.length > 0) {
      return xmlRows.slice(0, MAX_IMPORT_ROWS + 1);
    }
  } else {
    const csvRows = parseCsvRows(fallbackText);
    if (csvRows.length > 0) {
      return csvRows.slice(0, MAX_IMPORT_ROWS + 1);
    }
  }

  throw new Error('Could not parse this spreadsheet. Please ensure it is a valid .xlsx or .csv file.');
}

function normalizeHeader(cell: SpreadsheetCell): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Automatically maps spreadsheet header titles to FinTrack expense fields.
 */
export function detectImportColumnMapping(headers: string[]): ImportColumnMapping {
  const norm = headers.map((h) => normalizeHeader(h));

  const findIndex = (exactList: string[], partialList: string[]): number => {
    for (const exact of exactList) {
      const idx = norm.findIndex((h) => h === exact);
      if (idx !== -1) return idx;
    }
    for (const part of partialList) {
      const idx = norm.findIndex((h) => h.includes(part));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return {
    date: findIndex(['date', 'transaction date', 'txn date', 'spent on', 'posting date'], ['date']),
    title: findIndex(
      ['title', 'description', 'merchant', 'merchant or description', 'narration', 'particulars', 'item', 'name'],
      ['title', 'desc', 'merchant', 'narration', 'particular', 'memo', 'item'],
    ),
    amount: findIndex(
      ['original amount', 'amount', 'debit', 'cost', 'price', 'total', 'value'],
      ['original amount', 'amount', 'debit', 'spent', 'price', 'cost', 'converted amount'],
    ),
    category: findIndex(['category', 'group', 'type', 'expense category'], ['category']),
    currency: findIndex(['original currency', 'currency', 'curr', 'ccy', 'fx'], ['currency']),
    exchangeRate: findIndex(['exchange rate', 'fx rate', 'rate'], ['exchange rate']),
    notes: findIndex(['notes', 'note', 'remarks', 'comment', 'comments', 'details'], ['note', 'remark', 'comment']),
  };
}

export function normalizeImportedDate(cell: SpreadsheetCell): string | null {
  if (cell === null || cell === undefined || cell === '') return null;

  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    return isValidCalendarDate(iso) ? iso : null;
  }

  if (typeof cell === 'number' && Number.isFinite(cell) && cell > 20000 && cell < 80000) {
    // Excel serial day number (1899-12-30 epoch handles Excel 1900 leap-year bug cleanly)
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(cell) * 86_400_000);
    const iso = dt.toISOString().slice(0, 10);
    return isValidCalendarDate(iso) ? iso : null;
  }

  const raw = String(cell).trim();
  if (!raw) return null;

  // YYYY-MM-DD or YYYY/MM/DD (or ISO timestamp prefix)
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const candidate = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    return isValidCalendarDate(candidate) ? candidate : null;
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 14-Nov-2026)
  const namedMonthMatch = raw.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]+(\d{2,4})$/);
  if (namedMonthMatch) {
    const day = Number(namedMonthMatch[1]);
    const monthNum = MONTH_NAME_MAP[namedMonthMatch[2].toLowerCase()];
    const yearRaw = Number(namedMonthMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (monthNum) {
      const candidate = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return isValidCalendarDate(candidate) ? candidate : null;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY (supports - or /)
  const slashMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const yearRaw = Number(slashMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

    // Disambiguate DD/MM vs MM/DD: if second > 12 it must be MM/DD; otherwise prefer DD/MM (ISO/India/global)
    const day = second > 12 ? second : first;
    const month = second > 12 ? first : second;
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return isValidCalendarDate(candidate) ? candidate : null;
  }

  return null;
}

export function normalizeImportedCategory(cell: SpreadsheetCell): ExpenseCategory {
  const raw = String(cell ?? '').trim();
  if (!raw) return 'Other';

  const exact = CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const lower = raw.toLowerCase();
  if (/(house|rent|mortgage|apartment|repair|maintenance)/.test(lower)) return 'Housing';
  if (/(food|dining|restaurant|coffee|cafe|grocer|lunch|dinner|breakfast)/.test(lower)) return 'Food & Dining';
  if (/(transport|uber|ola|lyft|taxi|cab|fuel|petrol|diesel|metro|train|bus|parking)/.test(lower)) return 'Transport';
  if (/(utilit|electric|water|internet|wifi|fiber|phone|mobile|gas|broadband)/.test(lower)) return 'Utilities';
  if (/(health|medical|doctor|pharmacy|hospital|dental|clinic)/.test(lower)) return 'Healthcare';
  if (/(shop|amazon|flipkart|clothing|apparel|store|mall|electronics)/.test(lower)) return 'Shopping';
  if (/(entertain|movie|cinema|concert|game|music|sport|hobby)/.test(lower)) return 'Entertainment';
  if (/(travel|flight|airline|hotel|airbnb|vacation|trip|visa)/.test(lower)) return 'Travel';
  if (/(software|subscription|saas|cloud|netflix|spotify|icloud|hosting|ai)/.test(lower)) return 'Software & Subscriptions';
  return 'Other';
}

function parseAmountAndCurrency(
  cell: SpreadsheetCell,
  explicitCurrencyCell: SpreadsheetCell,
  defaultCurrency: CurrencyCode,
  convertNegativeToPositive: boolean,
): { amount: number | null; currency: CurrencyCode } {
  let detectedCurrency: CurrencyCode = defaultCurrency;

  if (explicitCurrencyCell !== null && explicitCurrencyCell !== undefined) {
    const rawCode = String(explicitCurrencyCell).trim().toUpperCase();
    if (isValidCurrency(rawCode)) {
      detectedCurrency = rawCode;
    }
  }

  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return { amount: null, currency: detectedCurrency };
    const val = convertNegativeToPositive && cell < 0 ? Math.abs(cell) : cell;
    return { amount: val, currency: detectedCurrency };
  }

  const rawStr = String(cell ?? '').trim();
  if (!rawStr) return { amount: null, currency: detectedCurrency };

  if (detectedCurrency === defaultCurrency) {
    for (const code of CURRENCIES) {
      if (rawStr.toUpperCase().includes(code)) {
        detectedCurrency = code;
        break;
      }
      const sym = CURRENCY_META[code].symbol;
      if (sym.length >= 1 && rawStr.includes(sym) && (sym !== '$' || !rawStr.includes('A$') && !rawStr.includes('CA$') && !rawStr.includes('S$'))) {
        detectedCurrency = code;
        break;
      }
    }
  }

  const parenNegative = /^\(.*\)$/.test(rawStr);
  const cleaned = rawStr.replace(/[,$\s₹€£¥A-Za-z()]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return { amount: null, currency: detectedCurrency };
  }
  const signed = parenNegative ? -Math.abs(parsed) : parsed;
  const val = convertNegativeToPositive && signed < 0 ? Math.abs(signed) : signed;
  return { amount: val, currency: detectedCurrency };
}

export function buildExpenseImportPreview(opts: {
  rows: SpreadsheetRows;
  mapping: ImportColumnMapping;
  defaultCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  existingExpenses: Expense[];
  convertNegativeToPositive?: boolean;
}): ImportParsePreview {
  const {
    rows,
    mapping,
    defaultCurrency,
    baseCurrency,
    rates,
    existingExpenses,
    convertNegativeToPositive = false,
  } = opts;

  if (rows.length <= 1) {
    return { validRows: [], invalidRows: [], duplicateCount: 0, totalBaseAmount: 0 };
  }

  if (mapping.date < 0 || mapping.title < 0 || mapping.amount < 0) {
    return {
      validRows: [],
      invalidRows: [
        {
          rowNumber: 1,
          reason: 'Map Date, Description, and Amount columns before importing.',
          rawPreview: rows[0].map((c) => String(c ?? '')).join(' | '),
        },
      ],
      duplicateCount: 0,
      totalBaseAmount: 0,
    };
  }

  const existingKeys = new Set(
    existingExpenses.map(
      (e) => `${e.date}|${e.title.trim().toLowerCase()}|${e.amount.toFixed(2)}|${e.currency}`,
    ),
  );

  const validRows: ImportedExpenseRow[] = [];
  const invalidRows: InvalidImportRow[] = [];
  let duplicateCount = 0;
  let totalBaseAmount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }

    const rowNumber = i + 1;
    const rawDate = r[mapping.date];
    const rawTitle = r[mapping.title];
    const rawAmount = r[mapping.amount];
    const rawCategory = mapping.category >= 0 ? r[mapping.category] : undefined;
    const rawCurrency = mapping.currency >= 0 ? r[mapping.currency] : undefined;
    const rawRate = mapping.exchangeRate >= 0 ? r[mapping.exchangeRate] : undefined;
    const rawNotes = mapping.notes >= 0 ? r[mapping.notes] : '';

    const normalizedDate = normalizeImportedDate(rawDate);
    if (!normalizedDate) {
      invalidRows.push({
        rowNumber,
        reason: `Unrecognized date "${String(rawDate ?? '')}"`,
        rawPreview: r.slice(0, 4).map((c) => String(c ?? '')).join(' · '),
      });
      continue;
    }

    const { amount, currency } = parseAmountAndCurrency(
      rawAmount,
      rawCurrency,
      defaultCurrency,
      convertNegativeToPositive,
    );

    if (amount === null || amount <= 0) {
      invalidRows.push({
        rowNumber,
        reason: `Invalid or non-positive amount "${String(rawAmount ?? '')}"`,
        rawPreview: r.slice(0, 4).map((c) => String(c ?? '')).join(' · '),
      });
      continue;
    }

    const parsedExplicitRate =
      rawRate !== null && rawRate !== undefined && String(rawRate).trim() !== ''
        ? Number(rawRate)
        : NaN;
    const { exchangeRate: computedRate } = convertCurrency(
      amount,
      currency,
      baseCurrency,
      rates,
      baseCurrency,
    );
    const exchangeRate =
      Number.isFinite(parsedExplicitRate) && parsedExplicitRate > 0
        ? parsedExplicitRate
        : computedRate;

    const category = normalizeImportedCategory(rawCategory);
    const title = stripFormulaShield(String(rawTitle ?? ''));
    const notes = stripFormulaShield(String(rawNotes ?? ''));

    const checked = validateExpenseInput({
      title,
      amount,
      currency,
      exchangeRate,
      category,
      date: normalizedDate,
      notes,
    });

    if (!checked.valid || !checked.sanitized) {
      const firstErr = Object.values(checked.errors)[0] || 'Invalid expense fields.';
      invalidRows.push({
        rowNumber,
        reason: firstErr,
        rawPreview: r.slice(0, 4).map((c) => String(c ?? '')).join(' · '),
      });
      continue;
    }

    const key = `${checked.sanitized.date}|${checked.sanitized.title.toLowerCase()}|${checked.sanitized.amount.toFixed(2)}|${checked.sanitized.currency}`;
    const isDuplicate = existingKeys.has(key);
    if (isDuplicate) duplicateCount++;

    totalBaseAmount = Math.round((totalBaseAmount + checked.sanitized.convertedAmount) * 100) / 100;
    validRows.push({
      rowNumber,
      sanitized: checked.sanitized,
      isDuplicate,
    });
  }

  return {
    validRows,
    invalidRows,
    duplicateCount,
    totalBaseAmount,
  };
}

export function buildExpenseImportTemplateCsv(baseCurrency: CurrencyCode): string {
  const rows = [
    ['Date', 'Title', 'Category', 'Original Amount', 'Original Currency', 'Notes'],
    ['2026-11-12', 'Blue Tokai Coffee', 'Food & Dining', '340.00', baseCurrency, 'Morning espresso'],
    ['2026-11-11', 'Metro Smart Card', 'Transport', '500.00', baseCurrency, 'Commute recharge'],
    ['2026-11-10', 'Cloud Backup Plan', 'Software & Subscriptions', '9.99', 'USD', 'Monthly storage'],
  ];
  return rows.map((r) => r.join(',')).join('\r\n');
}
