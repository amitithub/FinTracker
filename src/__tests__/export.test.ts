import { describe, expect, it, vi } from 'vitest';
import {
  downloadCsv,
  downloadExpensesPdf,
  escapeCsvCell,
  generateBackupJson,
  generateExpensesCsv,
  generateExpensesPdfBytes,
  parseAndValidateBackup,
} from '../lib/export';
import { Expense } from '../types/expense';

describe('CSV export security & RFC-4180 formatting', () => {
  it('neutralizes spreadsheet formula injection prefixes', () => {
    expect(escapeCsvCell('=CMD|calc')).toBe("'=CMD|calc");
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(escapeCsvCell('-1+1')).toBe("'-1+1");
    expect(escapeCsvCell('@SUM(1)')).toBe("'@SUM(1)");
    expect(escapeCsvCell('@SUM(1,1)')).toBe('"\'@SUM(1,1)"');
  });

  it('quotes commas, quotes, and newlines per RFC-4180', () => {
    expect(escapeCsvCell('Cafe, "Bistro"')).toBe('"Cafe, ""Bistro"""');
    expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
  });

  it('generates complete CSV output with header and converted amounts', () => {
    const rows: Expense[] = [
      {
        id: '1',
        ownerId: 'u1',
        title: '=MaliciousTitle',
        amount: 50,
        currency: 'EUR',
        exchangeRate: 1.1,
        convertedAmount: 55,
        category: 'Food & Dining',
        date: '2026-11-10',
        monthKey: '2026-11',
        notes: 'Team dinner, shared',
      },
    ];
    const csv = generateExpensesCsv(rows, 'USD');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Converted Amount (USD)');
    expect(lines[1]).toContain("'=MaliciousTitle");
    expect(lines[1]).toContain('"Team dinner, shared"');
  });

  it('generates and validates full FinTrack JSON backups and rejects corrupted payloads', () => {
    const json = generateBackupJson({
      preferences: {
        ownerId: 'u1',
        baseCurrency: 'INR',
        monthlyBudgetLimit: 50000,
        themePreference: 'dark',
      },
      expenses: [
        {
          id: 'e1',
          ownerId: 'u1',
          title: 'Cloud Hosting',
          amount: 1200,
          currency: 'INR',
          exchangeRate: 1,
          convertedAmount: 1200,
          category: 'Software & Subscriptions',
          date: '2026-11-10',
          monthKey: '2026-11',
          notes: 'Monthly bill',
        },
      ],
      budgets: [
        {
          id: 'b1',
          ownerId: 'u1',
          category: 'Software & Subscriptions',
          monthlyLimit: 3000,
          alertThresholdPercent: 80,
        },
      ],
      recurringBills: [
        {
          id: 'r1',
          ownerId: 'u1',
          title: 'Fiber Internet',
          amount: 999,
          currency: 'INR',
          category: 'Utilities',
          cadence: 'monthly',
          nextDueDate: '2026-12-01',
          autoRemind: true,
          lastPaidDate: '2026-11-01',
        },
      ],
    });

    const ok = parseAndValidateBackup(json);
    expect(ok.valid).toBe(true);
    if (ok.valid) {
      expect(ok.data.expenses).toHaveLength(1);
      expect(ok.data.budgets).toHaveLength(1);
      expect(ok.data.recurringBills).toHaveLength(1);
      expect(ok.data.preferences.baseCurrency).toBe('INR');
    }

    expect(parseAndValidateBackup('not json').valid).toBe(false);
    expect(parseAndValidateBackup(JSON.stringify({ app: 'Other', version: 1 })).valid).toBe(false);
    expect(
      parseAndValidateBackup(
        JSON.stringify({
          app: 'FinTrack',
          version: 1,
          expenses: [{ title: 'Bad', amount: -10, currency: 'INR', category: 'Other', date: '2026-02-30' }],
        }),
      ).valid,
    ).toBe(false);
  });

  it('generates valid multi-page PDF 1.4 reports with safe literal escaping', () => {
    const manyExpenses: Expense[] = Array.from({ length: 42 }, (_, idx) => ({
      id: `p_${idx}`,
      ownerId: 'u1',
      title: `Item (${idx + 1}) \\ Receipt`,
      amount: 100 + idx,
      currency: idx % 2 === 0 ? 'INR' : 'USD',
      exchangeRate: idx % 2 === 0 ? 1 : 84.4,
      convertedAmount: idx % 2 === 0 ? 100 + idx : (100 + idx) * 84.4,
      category: 'Food & Dining',
      date: '2026-11-10',
      monthKey: '2026-11',
      notes: '',
    }));

    const pdfBytes = generateExpensesPdfBytes({
      expenses: manyExpenses,
      baseCurrency: 'INR',
      scopeLabel: 'All History',
      referenceMonthLabel: 'November 2026',
      topCategoryLabel: 'Food & Dining (100%)',
    });

    const pdfText = new TextDecoder('latin1').decode(pdfBytes);
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdfText).toContain('/Count 2');
    expect(pdfText).toContain('Page 1 of 2');
    expect(pdfText).toContain('Page 2 of 2');
    expect(pdfText).toContain('Item \\(1\\) \\\\ Receipt');
    expect(pdfText).toContain('xref');
  });

  it('defers URL.revokeObjectURL during CSV and PDF downloads so browsers complete the stream', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('Date,Title\r\n2026-11-10,Coffee', 'report.csv');
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Must NOT revoke synchronously on the same tick
    expect(revokeSpy).not.toHaveBeenCalled();

    downloadExpensesPdf(
      {
        expenses: [],
        baseCurrency: 'INR',
        scopeLabel: 'Selected Month',
        referenceMonthLabel: 'November 2026',
        topCategoryLabel: '-',
      },
      'report.pdf',
    );
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_500);
    expect(revokeSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
