import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { NewPriceRow, JTLRow } from './types';

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  // Handle comma as decimal separator
  const str = String(val).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseNewPrices(file: File, skuColumn: string, ekColumn: string, vkColumn: string): Promise<NewPriceRow[]> {
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
          internerSchluessel: String(r['Interner Schlüssel'] ?? '').trim(),
          artikelnummer: String(r['Artikelnummer'] ?? '').trim(),
          eanBarcode: String(r['EAN Barcode'] ?? r['EAN'] ?? '').trim(),
          han: String(r['HAN'] ?? '').trim(),
          artikelname: String(r['Artikelname'] ?? '').trim(),
          ekNettoLieferant: parseNumber(r['EK netto Lieferant']),
          vkBrutto: parseNumber(r['VK brutto']),
          warengruppe: String(r['Warengruppe'] ?? '').trim(),
          hersteller: String(r['Hersteller'] ?? '').trim(),
          imZulauf: String(r['Im Zulauf'] ?? '').trim(),
          bestandGesamt: parseNumber(r['Bestand Gesamt']),
          bestandKG: r['Bestand KG'] !== undefined && r['Bestand KG'] !== '' ? parseNumber(r['Bestand KG']) : null,
          bestandNG: parseNumber(r['Bestand NG']),
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
