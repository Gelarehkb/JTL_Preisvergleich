import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { NewPriceRow, JTLRow, LagerEntry } from './types';

/* ============================================================
 * Auto-detection: separator (; , \t |) and decimal mark (, .)
 * ============================================================ */

async function readSample(file: File, bytes = 16384): Promise<string> {
  return await file.slice(0, bytes).text();
}

export function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
  if (!lines.length) return ';';
  const candidates = [';', '\t', '|', ','];
  let best = ';';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map(l => l.split(d).length - 1);
    const min = Math.min(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    // require at least one occurrence in every line + consistency
    if (min >= 1 && avg > bestScore) {
      bestScore = avg;
      best = d;
    }
  }
  return best;
}

export function detectDecimal(sample: string, delimiter: string): '.' | ',' {
  // If field separator is comma, decimal must be a dot.
  if (delimiter === ',') return '.';
  const commaDecimal = (sample.match(/\d,\d{1,3}(?!\d)/g) || []).length;
  const dotDecimal = (sample.match(/\d\.\d{1,3}(?!\d)/g) || []).length;
  return commaDecimal >= dotDecimal ? ',' : '.';
}

/** Parse a number using a known decimal mark; the other char is treated as thousands sep. */
export function parseNumberSmart(val: unknown, decimal: '.' | ','): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  let s = String(val).trim().replace(/\s/g, '');
  if (!s) return null;
  if (decimal === ',') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Backwards-compatible parseNumber: assumes German style (',' decimal). */
function parseNumber(val: unknown): number | null {
  return parseNumberSmart(val, ',');
}

function parseNumberOrZero(val: unknown, decimal: '.' | ',' = ','): number {
  return parseNumberSmart(val, decimal) ?? 0;
}

function normalizeHeader(s: string): string {
  return s.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Normalize an Interner Schl\u00FCssel value to a consistent string key.
 *  Handles: BOM, whitespace, Excel float representation (158279.0 \u2192 "158279"). */
export function normalizeSchluessel(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val).replace(/^\uFEFF/, '').trim();
  // Strip .0 / .00 suffix from Excel numeric cells (e.g. "158279.0" \u2192 "158279")
  return s.replace(/\.0+$/, '');
}

function resolveColumn(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  // Fallback: case/whitespace/BOM-insensitive lookup
  const wanted = names.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (wanted.includes(normalizeHeader(key))) {
      const v = row[key];
      if (v !== undefined && v !== '') return v;
    }
  }
  return undefined;
}

/* ============================================================
 * Generic CSV/XLSX read with auto-detection
 * ============================================================ */

interface RawTable {
  headers: string[];
  rows: Record<string, unknown>[];
  delimiter: string;
  decimal: '.' | ',';
}

async function readTable(file: File): Promise<RawTable> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    // XLSX gives real numbers already; decimal irrelevant
    return { headers, rows, delimiter: ';', decimal: '.' };
  }
  const sample = await readSample(file);
  const delimiter = detectDelimiter(sample);
  const decimal = detectDecimal(sample, delimiter);
  return await new Promise<RawTable>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: (result) => {
        resolve({
          headers: result.meta.fields ?? [],
          rows: result.data as Record<string, unknown>[],
          delimiter,
          decimal,
        });
      },
      error: (err) => reject(err),
    });
  });
}

/* ============================================================
 * Public API
 * ============================================================ */

export async function parseNewPrices(
  file: File,
  skuColumn: string,
  ekColumn: string | '',
  vkColumn: string | ''
): Promise<NewPriceRow[]> {
  const { rows, decimal } = await readTable(file);
  const readEK = (r: Record<string, unknown>) => (ekColumn ? parseNumberSmart(r[ekColumn], decimal) : null);
  const readVK = (r: Record<string, unknown>) => (vkColumn ? parseNumberSmart(r[vkColumn], decimal) : null);
  return rows
    .filter(r => r[skuColumn] !== undefined && r[skuColumn] !== '')
    .map(r => ({
      sku: String(r[skuColumn] ?? '').trim(),
      newEK: readEK(r),
      newVK: readVK(r),
      rawRow: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')])),
    }));
}

export async function parseJTL(file: File): Promise<{ rows: JTLRow[]; headers: string[] }> {
  const { rows, headers, decimal } = await readTable(file);
  const num = (v: unknown) => parseNumberSmart(v, decimal);
  const numZero = (v: unknown) => num(v) ?? 0;
  const internerSchluesselColumn =
    headers.find(h => normalizeHeader(h) === normalizeHeader('Interner Schlüssel'))
    ?? headers[0]
    ?? 'Interner Schlüssel';
  const jtlRows: JTLRow[] = rows.map(r => ({
    internerSchluessel: normalizeSchluessel(resolveColumn(r, internerSchluesselColumn, 'Interner Schlüssel', 'interner Schlüssel', 'Interner Schluessel', 'interner Schluessel', 'Interner schlüssel')),
    artikelnummer: String(resolveColumn(r, 'Artikelnummer', 'artikelnummer', 'Artikel-Nr', 'ArtikelNr') ?? '').trim(),
    eanBarcode: String(resolveColumn(r, 'EAN/Barcode', 'EAN Barcode', 'EAN', 'Barcode') ?? '').trim(),
    han: String(resolveColumn(r, 'HAN', 'han', 'Hersteller-Artikelnummer') ?? '').trim(),
    artikelname: String(resolveColumn(r, 'Artikelname', 'artikelname', 'Name') ?? '').trim(),
    ekNettoLieferant: num(resolveColumn(r, 'Netto-EK', 'EK netto [Lieferant]', 'EK netto Lieferant', 'EK Netto', 'EK netto', 'EK')),
    vkBrutto: num(resolveColumn(r, 'Std. VK Brutto', 'VK brutto', 'VK Brutto', 'VK')),
    lieferant: String(resolveColumn(r, 'Lieferant', 'lieferant', 'Lieferantenname', 'Supplier') ?? '').trim(),
    warengruppe: String(resolveColumn(r, 'Warengruppe', 'warengruppe') ?? '').trim(),
    hersteller: String(resolveColumn(r, 'Hersteller', 'hersteller') ?? '').trim(),
    imZulauf: String(resolveColumn(r, 'Im Zulauf', 'im Zulauf', 'ImZulauf', 'Zulauf') ?? '').trim(),
    bestandGesamt: numZero(resolveColumn(r, 'Lagerbestand Gesamt', 'Bestand Gesamt', 'BestandGesamt', 'Gesamt')),
    bestandKG: (() => { const v = resolveColumn(r, 'Lagerbestand Lager [KG-Store]', 'Bestand KG', 'BestandKG', 'Lager KG'); return v !== undefined && v !== '' ? numZero(v) : null; })(),
    bestandNG: numZero(resolveColumn(r, 'Lagerbestand Lager [WMS_HFK]', 'Bestand NG', 'BestandNG', 'Lager NG')),
  }));
  return { rows: jtlRows, headers };
}

export async function parseLagerFile(file: File): Promise<Map<string, LagerEntry>> {
  const { rows, headers } = await readTable(file);
  // Key by Artikelnummer (column 1 per the JTL Lager export format)
  const artikelnummerColumn =
    headers.find(h => normalizeHeader(h) === normalizeHeader('Artikelnummer'))
    ?? headers[0]
    ?? 'Artikelnummer';
  const map = new Map<string, LagerEntry>();
  for (const r of rows) {
    const key = String(resolveColumn(r, artikelnummerColumn, 'Artikelnummer', 'artikelnummer') ?? '').trim();
    if (!key) continue;
    if (map.has(key)) continue;
    map.set(key, {
      lagerplatz: String(resolveColumn(r, 'Lagerplatz', 'lagerplatz') ?? '').trim(),
      kommentar: String(resolveColumn(r, 'Kommentar', 'kommentar', 'Comment') ?? '').trim(),
      lieferant: String(resolveColumn(r, 'Lieferant', 'lieferant', 'Lieferantenname', 'Supplier') ?? '').trim(),
    });
  }
  console.log('[parseLagerFile] loaded', map.size, 'entries, sample keys:', [...map.keys()].slice(0, 5));
  return map;
}

export async function getColumnHeaders(file: File): Promise<string[]> {
  const { headers } = await readTable(file);
  return headers;
}

/** Preview first N rows (with auto-detected separator). */
export interface PreviewData {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  decimal: '.' | ',';
}

export async function getPreviewData(file: File, n = 20): Promise<PreviewData> {
  const { headers, rows, delimiter, decimal } = await readTable(file);
  const slice = rows.slice(0, n).map(r => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = r[h] === undefined || r[h] === null ? '' : String(r[h]);
    return out;
  });
  return { headers, rows: slice, delimiter, decimal };
}

/** Legacy 2/3-column CSV parser kept for compatibility. */
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
