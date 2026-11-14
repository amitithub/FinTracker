import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { buildRatesForBase } from '../lib/currency';
import {
  buildExpenseImportPreview,
  buildExpenseImportTemplateCsv,
  detectImportColumnMapping,
  normalizeImportedCategory,
  normalizeImportedDate,
  parseCsvRows,
  readUploadedExpenseSheet,
} from '../lib/importExpenses';
import { Expense } from '../types/expense';

function buildMinimalXlsxBuffer(): ArrayBuffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Expenses" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Date</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Description</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Category</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Amount</t></is></c>
      <c r="E1" t="inlineStr"><is><t>Currency</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>2026-11-12</t></is></c>
      <c r="B2" t="inlineStr"><is><t>Excel Flight Booking</t></is></c>
      <c r="C2" t="inlineStr"><is><t>Travel</t></is></c>
      <c r="D2"><v>12500</v></c>
      <c r="E2" t="inlineStr"><is><t>INR</t></is></c>
    </row>
  </sheetData>
</worksheet>`;

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
  });
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);
}

describe('CSV & Excel expense import parser', () => {
  it('parses RFC-4180 CSV rows, strips BOM and formula-injection single-quote shields', () => {
    const csv = `\uFEFFDate,Title,Category,Original Amount,Original Currency,Notes\r\n2026-11-10,"'=Cafe, Bistro",Food & Dining,450.50,INR,"Shared ""lunch"""`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe('=Cafe, Bistro');
    expect(rows[1][5]).toBe('Shared "lunch"');
  });

  it('normalizes ISO, slash, named month, and Excel serial dates accurately', () => {
    expect(normalizeImportedDate('2026-11-14')).toBe('2026-11-14');
    expect(normalizeImportedDate('14/11/2026')).toBe('2026-11-14');
    expect(normalizeImportedDate('14-Nov-2026')).toBe('2026-11-14');
    expect(normalizeImportedDate('2026-02-30')).toBeNull();
    // Excel serial 46340 -> 2026-11-14
    expect(normalizeImportedDate(46340)).toBe('2026-11-14');
    expect(normalizeImportedDate(new Date(Date.UTC(2026, 10, 14)))).toBe('2026-11-14');
  });

  it('normalizes fuzzy bank categories to valid FinTrack categories', () => {
    expect(normalizeImportedCategory('Uber Ride')).toBe('Transport');
    expect(normalizeImportedCategory('Monthly Rent')).toBe('Housing');
    expect(normalizeImportedCategory('Cloud Hosting')).toBe('Software & Subscriptions');
    expect(normalizeImportedCategory('Unknown Misc')).toBe('Other');
  });

  it('auto-detects columns, flags duplicates & invalid rows, and converts FX rates', () => {
    const template = buildExpenseImportTemplateCsv('INR');
    const rows = parseCsvRows(template);
    const mapping = detectImportColumnMapping(rows[0]);
    expect(mapping.date).toBe(0);
    expect(mapping.title).toBe(1);
    expect(mapping.category).toBe(2);
    expect(mapping.amount).toBe(3);
    expect(mapping.currency).toBe(4);
    expect(mapping.notes).toBe(5);

    const existing: Expense[] = [
      {
        id: 'existing-1',
        ownerId: 'u1',
        title: 'Blue Tokai Coffee',
        amount: 340,
        currency: 'INR',
        exchangeRate: 1,
        convertedAmount: 340,
        category: 'Food & Dining',
        date: '2026-11-12',
        monthKey: '2026-11',
        notes: '',
      },
    ];

    const rowsWithInvalid = [...rows, ['bad-date', 'Broken Entry', 'Other', '-50', 'INR', '']];
    const preview = buildExpenseImportPreview({
      rows: rowsWithInvalid,
      mapping,
      defaultCurrency: 'INR',
      baseCurrency: 'INR',
      rates: buildRatesForBase('INR'),
      existingExpenses: existing,
    });

    expect(preview.validRows).toHaveLength(3);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.validRows[0].isDuplicate).toBe(true);
    expect(preview.validRows[2].sanitized.currency).toBe('USD');
    expect(preview.validRows[2].sanitized.convertedAmount).toBeGreaterThan(9.99);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.invalidRows[0].rowNumber).toBe(5);
  });

  it('reads modern Excel .xlsx workbooks and gives clear guidance for legacy binary .xls files', async () => {
    const xlsxBuffer = buildMinimalXlsxBuffer();
    const xlsxRows = await readUploadedExpenseSheet({
      name: 'bank-export.xlsx',
      size: xlsxBuffer.byteLength,
      arrayBuffer: async () => xlsxBuffer,
    });

    expect(xlsxRows).toHaveLength(2);
    expect(xlsxRows[1][1]).toBe('Excel Flight Booking');
    expect(xlsxRows[1][3]).toBe(12500);

    const oleHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]).buffer;
    await expect(
      readUploadedExpenseSheet({
        name: 'legacy.xls',
        size: oleHeader.byteLength,
        arrayBuffer: async () => oleHeader,
      }),
    ).rejects.toThrow(/Save As \.xlsx or \.csv/i);
  });
});
