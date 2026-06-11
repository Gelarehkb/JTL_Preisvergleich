import type { ComparisonResultRow, UnmatchedJTLRow } from './types';

function formatNum(n: number | null): string {
  if (n === null) return '';
  return n.toFixed(2).replace('.', ',');
}

function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function toCsvLine(values: string[]): string {
  return values.map(escapeCsvField).join(';');
}

function downloadCsv(content: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fullHeader(idLabel: string): string[] {
  return [
    'Interner Schlüssel', idLabel, 'OLD EK', 'NEW EK', 'EK Differenz', 'EK Geändert',
    'OLD VK', 'NEW VK', 'VK Differenz', 'VK Geändert',
    'Im Zulauf', 'Bestand Gesamt', 'Bestand KG', 'Bestand NG',
  ];
}

function fullRow(r: ComparisonResultRow): string[] {
  return [
    r.internerSchluessel,
    r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.deltaEK), r.changedEK ? 'Ja' : 'Nein',
    formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK), r.changedVK ? 'Ja' : 'Nein',
    r.imZulauf, String(r.bestandGesamt),
    r.bestandKG !== null ? String(r.bestandKG) : '',
    String(r.bestandNG),
  ];
}

export function exportAllRows(rows: ComparisonResultRow[]) {
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine(fullHeader(idLabel));
  const lines = rows.map(r => toCsvLine(fullRow(r)));
  downloadCsv([header, ...lines].join('\n'), 'vergleich_alle.csv');
}

export function exportChangedOnly(rows: ComparisonResultRow[]) {
  const changed = rows.filter(r => r.changedEK || r.changedVK);
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine([
    'Interner Schlüssel', idLabel, 'OLD EK', 'NEW EK', 'EK Differenz',
    'OLD VK', 'NEW VK', 'VK Differenz',
  ]);
  const lines = changed.map(r => toCsvLine([
    r.internerSchluessel,
    r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.deltaEK),
    formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'preisaenderungen.csv');
}


/* ── New exports ── */

export function exportBestandNGgt0(rows: ComparisonResultRow[]) {
  const filtered = rows.filter(r => r.newVK !== null && r.bestandNG > 0);
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'Barcode' : 'HAN';
  const header = toCsvLine(['Interner Schlüssel', 'Artikelnummer', idLabel, 'New VK', 'Old VK', 'Lager Bestand NG']);
  const lines = filtered.map(r => toCsvLine([
    r.internerSchluessel,
    r.artikelnummer,
    r.identifier,
    formatNum(r.newVK),
    formatNum(r.oldVK),
    String(r.bestandNG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'export_bestand_ng_gt_0.csv');
}

export function exportBestandKGgt0(rows: ComparisonResultRow[]) {
  const filtered = rows.filter(r => r.newVK !== null && r.bestandKG !== null && r.bestandKG > 0);
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'Barcode' : 'HAN';
  const header = toCsvLine(['Interner Schlüssel', 'Artikelnummer', idLabel, 'New VK', 'Old VK', 'Lager Bestand KG']);
  const lines = filtered.map(r => toCsvLine([
    r.internerSchluessel,
    r.artikelnummer,
    r.identifier,
    formatNum(r.newVK),
    formatNum(r.oldVK),
    r.bestandKG !== null ? String(r.bestandKG) : '',
  ]));
  downloadCsv([header, ...lines].join('\n'), 'export_bestand_kg_gt_0.csv');
}

export function exportDCEan(unmatchedJTLRows: UnmatchedJTLRow[]) {
  if (unmatchedJTLRows.length === 0) return;

  const header = toCsvLine(['Interner Schlüssel', 'DC/OP', 'Ist Active']);
  const lines = unmatchedJTLRows.map(r => {
    const isOP = r.bestandGesamt > 0;
    return toCsvLine([
      r.internerSchluessel,
      isOP ? 'OP' : '',
      isOP ? 'Y' : 'N',
    ]);
  });
  downloadCsv([header, ...lines].join('\n'), 'export_DC_ean.csv');
}
