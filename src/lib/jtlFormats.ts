import { headerListHasAny, resolveColumn } from './headerUtils';

/**
 * Registry of supported JTL export formats. Each format lists, per internal
 * field, the header name(s) that export variant uses. To support another JTL
 * export variant, add a new entry here — parseJTL(), detection and validation
 * all work off this list, so nothing else needs to change.
 */
export interface JTLFieldCandidates {
  internerSchluessel: string[];
  artikelnummer: string[];
  eanBarcode: string[];
  han: string[];
  artikelname: string[];
  ekNettoLieferant: string[];
  vkBrutto: string[];
  lieferant: string[];
  warengruppe: string[];
  hersteller: string[];
  imZulauf: string[];
  bestandGesamt: string[];
  bestandKG: string[];
  bestandNG: string[];
}

export interface JTLFormatDefinition {
  id: string;
  label: string;
  columns: JTLFieldCandidates;
}

export const JTL_FORMATS: JTLFormatDefinition[] = [
  {
    id: 'standard',
    label: 'JTL-Export (Standard)',
    columns: {
      internerSchluessel: ['Interner Schlüssel', 'interner Schlüssel', 'Interner Schluessel', 'interner Schluessel', 'Interner schlüssel'],
      artikelnummer: ['Artikelnummer', 'artikelnummer', 'Artikel-Nr', 'ArtikelNr'],
      eanBarcode: ['EAN/Barcode', 'EAN Barcode', 'EAN', 'Barcode'],
      han: ['HAN', 'han', 'Hersteller-Artikelnummer'],
      artikelname: ['Artikelname', 'artikelname', 'Name'],
      ekNettoLieferant: ['Netto-EK', 'EK netto [Lieferant]', 'EK netto Lieferant', 'EK Netto', 'EK netto', 'EK'],
      vkBrutto: ['Std. VK Brutto', 'VK brutto', 'VK Brutto', 'VK'],
      lieferant: ['Lieferant', 'lieferant', 'Lieferantenname', 'Supplier'],
      warengruppe: ['Warengruppe', 'warengruppe'],
      hersteller: ['Hersteller', 'hersteller'],
      imZulauf: ['Im Zulauf', 'im Zulauf', 'ImZulauf', 'Zulauf'],
      bestandGesamt: ['Lagerbestand Gesamt', 'Bestand Gesamt', 'BestandGesamt', 'Gesamt'],
      bestandKG: ['Lagerbestand Lager [KG-Store]', 'Bestand KG', 'BestandKG', 'Lager KG'],
      bestandNG: ['Lagerbestand Lager [WMS_HFK]', 'Bestand NG', 'BestandNG', 'Lager NG'],
    },
  },
  {
    id: 'artikelliste',
    label: 'JTL-Artikelliste-Export',
    columns: {
      internerSchluessel: ['Interner Schlüssel', 'interner Schlüssel', 'Interner Schluessel', 'interner Schluessel', 'Interner schlüssel'],
      artikelnummer: ['Artikelnummer', 'artikelnummer', 'Artikel-Nr', 'ArtikelNr'],
      eanBarcode: ['EAN', 'EAN/Barcode', 'EAN Barcode', 'Barcode'],
      han: ['HAN', 'han', 'Hersteller-Artikelnummer'],
      artikelname: ['Artikelname', 'artikelname', 'Name'],
      ekNettoLieferant: ['Ø Netto-EK', 'O Netto-EK', 'Netto-EK', 'EK'],
      vkBrutto: ['Brutto-VK', 'VK Brutto', 'VK brutto', 'VK'],
      lieferant: ['Lieferant', 'lieferant', 'Lieferantenname', 'Supplier'],
      warengruppe: ['Warengruppe', 'warengruppe'],
      hersteller: ['Hersteller', 'hersteller'],
      imZulauf: ['Im Zulauf', 'im Zulauf', 'ImZulauf', 'Zulauf'],
      bestandGesamt: ['Lagerbestand (gesamt)', 'Lagerbestand Gesamt', 'Bestand Gesamt', 'BestandGesamt', 'Gesamt'],
      bestandKG: ['Lagerbestand Lager [KG-Store]', 'Bestand KG', 'BestandKG', 'Lager KG'],
      bestandNG: ['Lagerbestand Lager [WMS_HFK]', 'Bestand NG', 'BestandNG', 'Lager NG'],
    },
  },
];

/** Fields whose header names differ enough between formats to identify which was uploaded. */
const DISCRIMINATING_FIELDS: (keyof JTLFieldCandidates)[] = ['ekNettoLieferant', 'vkBrutto'];

/** Picks the registered format whose EK/VK header names best match the file. Falls back to
 *  the first registered format if no format's header names appear at all — downstream field
 *  resolution still checks every format's candidates, so this fallback never hides a column. */
export function detectJTLFormat(headers: string[]): JTLFormatDefinition {
  let best = JTL_FORMATS[0];
  let bestScore = -1;
  for (const format of JTL_FORMATS) {
    const score = DISCRIMINATING_FIELDS.reduce(
      (n, field) => n + (headerListHasAny(headers, format.columns[field]) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = format;
    }
  }
  return best;
}

/** All header names known for a field, across every registered format, deduplicated. */
function allCandidates(field: keyof JTLFieldCandidates): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const format of JTL_FORMATS) {
    for (const name of format.columns[field]) {
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

/** Resolves one internal field's value for a row: tries the detected format's own header
 *  names first, then every other registered format's names as a fallback. The fallback means
 *  a single mis-detected or renamed column doesn't take down the whole file. */
export function resolveJTLField(
  row: Record<string, unknown>,
  field: keyof JTLFieldCandidates,
  detected: JTLFormatDefinition
): unknown {
  const primary = detected.columns[field];
  const rest = allCandidates(field).filter(name => !primary.includes(name));
  return resolveColumn(row, ...primary, ...rest);
}

const CORE_FIELD_LABELS: Record<string, string> = {
  eanBarcode: 'EAN',
  han: 'HAN',
  ekNettoLieferant: 'EK',
  vkBrutto: 'VK',
};

/** Throws a descriptive error if the columns the app actually needs (EK, VK, and at least
 *  one of EAN/HAN to match rows by) can't be found under any registered format's header
 *  names. Checks across ALL formats, not just the detected one, so a file that mixes header
 *  conventions from different exports still passes as long as every field is found somewhere. */
export function assertJTLColumnsPresent(headers: string[]): void {
  const missing: string[] = [];
  for (const field of ['ekNettoLieferant', 'vkBrutto'] as const) {
    if (!headerListHasAny(headers, allCandidates(field))) missing.push(CORE_FIELD_LABELS[field]);
  }
  const hasIdentifier =
    headerListHasAny(headers, allCandidates('eanBarcode')) || headerListHasAny(headers, allCandidates('han'));
  if (!hasIdentifier) missing.push('EAN oder HAN');

  if (missing.length > 0) {
    throw new Error(
      `JTL-Export: Benötigte Spalte(n) nicht gefunden: ${missing.join(', ')}. ` +
      `Gefundene Spalten in der Datei: ${headers.join(', ') || '(keine)'}. ` +
      `Unterstützte Formate: ${JTL_FORMATS.map(f => f.label).join(', ')}.`
    );
  }
}
