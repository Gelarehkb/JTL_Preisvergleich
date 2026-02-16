import type { ComparisonResultRow } from './types';

function formatNum(n: number | null): string {
  if (n === null) return '';
  return n.toFixed(2).replace('.', ',');
}

function toCsvLine(values: string[]): string {
  return values.join(';');
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

export function exportAllRows(rows: ComparisonResultRow[]) {
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine([
    idLabel, 'OLD EK', 'NEW EK', 'EK Differenz', 'EK Geändert',
    'OLD VK', 'NEW VK', 'VK Differenz', 'VK Geändert',
    'Im Zulauf', 'Bestand Gesamt', 'Bestand KG', 'Bestand NG',
  ]);
  const lines = rows.map(r => toCsvLine([
    r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.deltaEK), r.changedEK ? 'Ja' : 'Nein',
    formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK), r.changedVK ? 'Ja' : 'Nein',
    r.imZulauf, String(r.bestandGesamt),
    r.bestandKG !== null ? String(r.bestandKG) : '',
    String(r.bestandNG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'vergleich_alle.csv');
}

export function exportChangedOnly(rows: ComparisonResultRow[]) {
  const changed = rows.filter(r => r.changedEK || r.changedVK);
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine([
    idLabel, 'OLD EK', 'NEW EK', 'EK Differenz',
    'OLD VK', 'NEW VK', 'VK Differenz',
  ]);
  const lines = changed.map(r => toCsvLine([
    r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.deltaEK),
    formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'preisaenderungen.csv');
}

export function exportStockNG(rows: ComparisonResultRow[]) {
  const filtered = rows.filter(r => (r.changedEK || r.changedVK) && r.bestandNG > 0);
  const header = toCsvLine([
    'Interner Schlüssel', 'Identifier', 'OLD EK', 'NEW EK', 'OLD VK', 'NEW VK', 'VK Differenz', 'Bestand NG',
  ]);
  const lines = filtered.map(r => toCsvLine([
    r.internerSchluessel, r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK),
    String(r.bestandNG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'bestand_ng.csv');
}

export function exportStockKG(rows: ComparisonResultRow[]) {
  const filtered = rows.filter(r => (r.changedEK || r.changedVK) && r.bestandKG !== null && r.bestandKG > 0);
  const header = toCsvLine([
    'Interner Schlüssel', 'Identifier', 'OLD EK', 'NEW EK', 'OLD VK', 'NEW VK', 'VK Differenz', 'Bestand KG',
  ]);
  const lines = filtered.map(r => toCsvLine([
    r.internerSchluessel, r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK),
    String(r.bestandKG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'bestand_kg.csv');
}
