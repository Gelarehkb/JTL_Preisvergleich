import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { NewPriceRow, JTLRow } from './types';

/**
 * Parse a numeric value. Returns null if the cell is empty/missing,
 * so empty prices are never silently converted to 0.
 */
function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/\s/g, '').replace(',', '.');
  if (str === '') return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/** Always returns a number (defaults to 0 for stock/quantity fields) */
function parseNumberOrZero(val: unknown): number {
  return parseNumber(val) ?? 0;
}

/**
 * Resolve a column value with fallback names.
 * Tries each name in order and returns the first non-undefined value.
 */
function resolveColumn(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
  }
  return undefined;
}

export function parseNewPrices(file: File, skuColumn: string, ekColumn: string | '', vkColumn: string | ''): Promise<NewPriceRow[]> {
  const readEK = (r: Record<string, unknown>) => (ekColumn ? parseNumber(r[ekColumn]) : null);
  const readVK = (r: Record<string, unknown>) => (vkColumn ? parseNumber(r[vkColumn]) : null);
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
          const result: NewPriceRow[] = rows
            .filter(r => r[skuColumn] !== undefined && r[skuColumn] !== '')
            .map(r => ({
              sku: String(r[skuColumn] ?? '').trim(),
              newEK: parseNumber(r[ekColumn]),
              newVK: parseNumber(r[vkColumn]),
            }));
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        complete: (result) => {
          const rows: NewPriceRow[] = (result.data as Record<string, unknown>[])
            .filter(r => r[skuColumn] !== undefined && r[skuColumn] !== '')
            .map(r => ({
              sku: String(r[skuColumn] ?? '').trim(),
              newEK: parseNumber(r[ekColumn]),
              newVK: parseNumber(r[vkColumn]),
            }));
          resolve(rows);
        },
        error: (err) => reject(err),
      });
    }
  });
}

export function parseJTL(file: File): Promise<{ rows: JTLRow[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const rows: JTLRow[] = (result.data as Record<string, unknown>[]).map(r => ({
          internerSchluessel: String(resolveColumn(r, 'Interner Schlüssel', 'interner Schlüssel', 'Interner Schluessel', 'interner Schluessel', 'Interner schlüssel') ?? '').trim(),
          artikelnummer: String(r['Artikelnummer'] ?? '').trim(),
          eanBarcode: String(resolveColumn(r, 'EAN/Barcode', 'EAN Barcode', 'EAN') ?? '').trim(),
          han: String(r['HAN'] ?? '').trim(),
          artikelname: String(r['Artikelname'] ?? '').trim(),
          ekNettoLieferant: parseNumber(resolveColumn(r, 'EK netto [Lieferant]', 'EK netto Lieferant', 'EK Netto', 'EK netto', 'EK')),
          vkBrutto: parseNumber(resolveColumn(r, 'VK brutto', 'VK Brutto', 'VK')),
          warengruppe: String(r['Warengruppe'] ?? '').trim(),
          hersteller: String(r['Hersteller'] ?? '').trim(),
          imZulauf: String(r['Im Zulauf'] ?? '').trim(),
          bestandGesamt: parseNumberOrZero(r['Bestand Gesamt']),
          bestandKG: r['Bestand KG'] !== undefined && r['Bestand KG'] !== '' ? parseNumberOrZero(r['Bestand KG']) : null,
          bestandNG: parseNumberOrZero(r['Bestand NG']),
        }));
        resolve({ rows, headers });
      },
      error: (err) => reject(err),
    });
  });
}

export function getColumnHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
          const headers = (rows[0] as unknown as string[]) ?? [];
          resolve(headers.map(String));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        preview: 1,
        delimiter: ';',
        complete: (result) => {
          resolve(result.meta.fields ?? []);
        },
        error: (err) => reject(err),
      });
    }
  });
}

/**
 * Parse a simple new-prices CSV with exactly 3 columns.
 * Uses semicolon delimiter and the same parseNumber logic (null for empty).
 * The first column is the identifier, second is EK, third is VK.
 * Column headers are auto-detected from the first row.
 */
/**
 * Parse a new-prices CSV with 2 or 3 columns.
 * 3 columns: Identifier;EK;VK
 * 2 columns: Identifier;EK or Identifier;VK (determined by secondColumnType)
 */
export function parseNewPricesCsv(file: File, secondColumnType?: 'EK' | 'VK'): Promise<NewPriceRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        if (headers.length < 2) {
          reject(new Error(`CSV muss mindestens 2 Spalten haben (gefunden: ${headers.length}).`));
          return;
        }
        const skuCol = headers[0];
        const data = result.data as Record<string, unknown>[];
        let rows: NewPriceRow[];

        if (headers.length === 2) {
          const valCol = headers[1];
          rows = data
            .filter(r => String(r[skuCol] ?? '').trim() !== '')
            .map(r => ({
              sku: String(r[skuCol] ?? '').trim(),
              newEK: secondColumnType === 'EK' ? parseNumber(r[valCol]) : null,
              newVK: secondColumnType === 'VK' ? parseNumber(r[valCol]) : null,
            }));
        } else {
          const ekCol = headers[1];
          const vkCol = headers[2];
          rows = data
            .filter(r => String(r[skuCol] ?? '').trim() !== '')
            .map(r => ({
              sku: String(r[skuCol] ?? '').trim(),
              newEK: parseNumber(r[ekCol]),
              newVK: parseNumber(r[vkCol]),
            }));
        }
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}
