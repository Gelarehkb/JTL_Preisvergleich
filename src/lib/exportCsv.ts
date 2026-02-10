import type { PriceChangeRow, StockNGRow, StockKGRow } from './types';

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

export function exportPriceChanges(rows: PriceChangeRow[]) {
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine([
    idLabel, 'OLD EK', 'NEW EK', 'EK Differenz',
    'OLD VK', 'NEW VK', 'VK Differenz'
  ]);
  const lines = rows.map(r => {
    const ekDiff = r.oldEK !== null && r.newEK !== null ? r.newEK - r.oldEK : null;
    const vkDiff = r.oldVK !== null && r.newVK !== null ? r.newVK - r.oldVK : null;
    return toCsvLine([
      r.identifierValue,
      formatNum(r.oldEK), formatNum(r.newEK), ekDiff !== null ? formatNum(ekDiff) : 'N/A',
      formatNum(r.oldVK), formatNum(r.newVK), vkDiff !== null ? formatNum(vkDiff) : 'N/A',
    ]);
  });
  downloadCsv([header, ...lines].join('\n'), 'preisaenderungen.csv');
}

export function exportStockNG(rows: StockNGRow[]) {
  const header = toCsvLine([
    'Interner Schlüssel', 'Identifier Typ', 'Identifier Wert',
    'Alt EK', 'Neu EK', 'Alt VK', 'Neu VK', 'VK Differenz', 'Bestand NG'
  ]);
  const lines = rows.map(r => toCsvLine([
    r.internerSchluessel, r.identifierType, r.identifierValue,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.vkDifference),
    formatNum(r.bestandNG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'bestand_ng.csv');
}

export function exportStockKG(rows: StockKGRow[]) {
  const header = toCsvLine([
    'Interner Schlüssel', 'Identifier Typ', 'Identifier Wert',
    'Alt EK', 'Neu EK', 'Alt VK', 'Neu VK', 'VK Differenz', 'Bestand KG'
  ]);
  const lines = rows.map(r => toCsvLine([
    r.internerSchluessel, r.identifierType, r.identifierValue,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.vkDifference),
    formatNum(r.bestandKG),
  ]));
  downloadCsv([header, ...lines].join('\n'), 'bestand_kg.csv');
}
