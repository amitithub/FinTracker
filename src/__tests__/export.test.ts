import { describe, expect, it } from 'vitest';
import { escapeCsvCell, generateExpensesCsv } from '../lib/export';
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
});
