import JSZip from 'jszip';
import type { ComparisonResultRow, UnmatchedJTLRow, UnmatchedRow, LagerEntry } from './types';

const BOM = '﻿';

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
    'Im Zulauf', 'Bestand Gesamt', 'Bestand KG', 'Bestand NG', 'Lieferant',
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
    r.lieferant,
  ];
}

/* ── Content builders (pure — no side effects) ── */

function buildAllRows(rows: ComparisonResultRow[]): { content: string; filename: string } | null {
  if (rows.length === 0) return null;
  const idLabel = rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const lines = [toCsvLine(fullHeader(idLabel)), ...rows.map(r => toCsvLine(fullRow(r)))];
  return { content: lines.join('\n'), filename: 'vergleich_alle.csv' };
}

function buildChangedOnly(rows: ComparisonResultRow[]): { content: string; filename: string } | null {
  const changed = rows.filter(r => r.changedEK || r.changedVK);
  if (changed.length === 0) return null;
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN';
  const header = toCsvLine([
    'Interner Schlüssel', idLabel, 'OLD EK', 'NEW EK', 'EK Differenz',
    'OLD VK', 'NEW VK', 'VK Differenz', 'Lieferant',
  ]);
  const lines = changed.map(r => toCsvLine([
    r.internerSchluessel, r.identifier,
    formatNum(r.oldEK), formatNum(r.newEK), formatNum(r.deltaEK),
    formatNum(r.oldVK), formatNum(r.newVK), formatNum(r.deltaVK),
    r.lieferant,
  ]));
  return { content: [header, ...lines].join('\n'), filename: 'preisaenderungen.csv' };
}

function buildBestandNG(
  rows: ComparisonResultRow[],
  lagerMap?: Map<string, LagerEntry>,
): { content: string; filename: string } | null {
  const filtered = rows.filter(r => r.changedVK && r.bestandNG > 0);
  if (filtered.length === 0) return null;
  if (lagerMap) {
    const hits = filtered.filter(r => lagerMap.has(r.artikelnummer)).length;
    console.log(`[buildBestandNG] lagerMap size=${lagerMap.size}, rows=${filtered.length}, hits=${hits}`, 'sample row key:', filtered[0]?.artikelnummer, 'sample map key:', [...lagerMap.keys()][0]);
  }
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'Barcode' : 'HAN';
  const extraHeaders = lagerMap ? ['Lagerplatz', 'Kommentar'] : [];
  const header = toCsvLine(['Interner Schlüssel', 'Artikelnummer', idLabel, 'New VK', 'Old VK', 'Lager Bestand NG', ...extraHeaders, 'Lieferant']);
  const lines = filtered.map(r => {
    const lager = lagerMap?.get(r.artikelnummer);
    const extraValues = lagerMap ? [lager?.lagerplatz ?? '', lager?.kommentar ?? ''] : [];
    const lieferant = lager?.lieferant || r.lieferant;
    return toCsvLine([
      r.internerSchluessel, r.artikelnummer, r.identifier,
      formatNum(r.newVK), formatNum(r.oldVK), String(r.bestandNG),
      ...extraValues, lieferant,
    ]);
  });
  return { content: [header, ...lines].join('\n'), filename: 'export_bestand_ng_gt_0.csv' };
}

function buildBestandKG(
  rows: ComparisonResultRow[],
): { content: string; filename: string } | null {
  const filtered = rows.filter(r => r.changedVK && (r.bestandKG ?? 0) > 0);
  if (filtered.length === 0) return null;
  const idLabel = rows.length > 0 && rows[0].identifierType === 'EAN' ? 'Barcode' : 'HAN';
  const header = toCsvLine(['Interner Schlüssel', 'Artikelnummer', idLabel, 'New VK', 'Old VK', 'Lager Bestand KG', 'Lieferant']);
  const lines = filtered.map(r => toCsvLine([
    r.internerSchluessel, r.artikelnummer, r.identifier,
    formatNum(r.newVK), formatNum(r.oldVK), String(r.bestandKG ?? ''),
    r.lieferant,
  ]));
  return { content: [header, ...lines].join('\n'), filename: 'export_bestand_kg_gt_0.csv' };
}

function buildDCEan(
  unmatchedJTLRows: UnmatchedJTLRow[],
  identifierType: 'HAN' | 'EAN',
): { content: string; filename: string } | null {
  if (unmatchedJTLRows.length === 0) return null;
  const idLabel = identifierType === 'EAN' ? 'Barcode' : 'HAN';
  const header = toCsvLine(['Interner Schlüssel', 'Artikelnummer', idLabel, 'Name', 'DC/OP', 'Ist Active', 'Lieferant']);
  const lines = unmatchedJTLRows.map(r => {
    const isOP = r.bestandGesamt > 0;
    return toCsvLine([r.internerSchluessel, r.artikelnummer, r.identifier, 'DC/OP', isOP ? 'OP' : '', isOP ? 'Y' : 'N', r.lieferant]);
  });
  return { content: [header, ...lines].join('\n'), filename: 'export_DC_ean.csv' };
}

function buildNeuAnlegen(unmatchedRows: UnmatchedRow[]): { content: string; filename: string } | null {
  const withRaw = unmatchedRows.filter(r => r.rawRow && Object.keys(r.rawRow).length > 0);
  if (withRaw.length === 0) return null;
  const headers = Object.keys(withRaw[0].rawRow!);
  const lines = [toCsvLine(headers), ...withRaw.map(r => toCsvLine(headers.map(h => r.rawRow![h] ?? '')))];
  return { content: lines.join('\n'), filename: 'export_neu_anlegen.csv' };
}

/* ── Public individual download functions ── */

export function exportAllRows(rows: ComparisonResultRow[]) {
  const f = buildAllRows(rows);
  if (f) downloadCsv(f.content, f.filename);
}

export function exportChangedOnly(rows: ComparisonResultRow[]) {
  const f = buildChangedOnly(rows);
  if (f) downloadCsv(f.content, f.filename);
}

export function exportBestandNGgt0(rows: ComparisonResultRow[], lagerMap?: Map<string, LagerEntry>) {
  const f = buildBestandNG(rows, lagerMap);
  if (f) downloadCsv(f.content, f.filename);
}

export function exportBestandKGgt0(rows: ComparisonResultRow[]) {
  const f = buildBestandKG(rows);
  if (f) downloadCsv(f.content, f.filename);
}

export function exportDCEan(unmatchedJTLRows: UnmatchedJTLRow[], identifierType: 'HAN' | 'EAN' = 'EAN') {
  const f = buildDCEan(unmatchedJTLRows, identifierType);
  if (f) downloadCsv(f.content, f.filename);
}

export function exportNeuAnlegen(unmatchedRows: UnmatchedRow[]) {
  const f = buildNeuAnlegen(unmatchedRows);
  if (f) downloadCsv(f.content, f.filename);
}

/* ── Download all as a single ZIP ── */

export async function downloadAllExports(
  rows: ComparisonResultRow[],
  unmatchedJTLRows: UnmatchedJTLRow[],
  unmatchedRows: UnmatchedRow[],
  identifierType: 'HAN' | 'EAN',
  lagerMap?: Map<string, LagerEntry>,
) {
  const files = [
    buildAllRows(rows),
    buildChangedOnly(rows),
    buildBestandNG(rows, lagerMap),
    buildBestandKG(rows),
    buildDCEan(unmatchedJTLRows, identifierType),
    buildNeuAnlegen(unmatchedRows),
  ].filter((f): f is { content: string; filename: string } => f !== null);

  if (files.length === 0) return;

  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, BOM + f.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'preisvergleich_exports.zip';
  a.click();
  URL.revokeObjectURL(url);
}
