import { headerListHasAny, normalizeHeader, resolveColumn } from './headerUtils';

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

/** User-chosen column overrides for the fields exposed in the column-mapping UI.
 *  An empty/missing entry means "use auto-detection for this field". */
export interface JTLColumnOverrides {
  eanBarcode?: string;
  han?: string;
  ekNettoLieferant?: string;
  vkBrutto?: string;
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

/** Resolves one internal field's value for a row. If the user picked a column for this
 *  field manually (via the column-mapping UI), that column wins outright. Otherwise tries
 *  the detected format's own header names first, then every other registered format's names
 *  as a fallback — so a single mis-detected or renamed column doesn't take down the whole file. */
export function resolveJTLField(
  row: Record<string, unknown>,
  field: keyof JTLFieldCandidates,
  detected: JTLFormatDefinition,
  overrideColumn?: string
): unknown {
  if (overrideColumn) return resolveColumn(row, overrideColumn);
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

/** Finds the actual header name (as it literally appears in the file) that matches one of the
 *  given candidates, for prefilling the column-mapping UI with a suggestion. */
function resolveHeaderName(headers: string[], candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const normCandidate = normalizeHeader(candidate);
    const hit = headers.find(h => normalizeHeader(h) === normCandidate);
    if (hit) return hit;
  }
  return undefined;
}

/** Suggested column mapping for the EAN/HAN/EK/VK fields, used to prefill the column-mapping
 *  dialog. Detects the format first so the detected format's own header names are preferred,
 *  then falls back to every other registered format's names. */
export function suggestJTLColumns(headers: string[]): {
  formatId: string;
  formatLabel: string;
  eanBarcode?: string;
  han?: string;
  ekNettoLieferant?: string;
  vkBrutto?: string;
} {
  const format = detectJTLFormat(headers);
  const suggest = (field: keyof JTLFieldCandidates) => {
    const primary = format.columns[field];
    const rest = allCandidates(field).filter(name => !primary.includes(name));
    return resolveHeaderName(headers, [...primary, ...rest]);
  };
  return {
    formatId: format.id,
    formatLabel: format.label,
    eanBarcode: suggest('eanBarcode'),
    han: suggest('han'),
    ekNettoLieferant: suggest('ekNettoLieferant'),
    vkBrutto: suggest('vkBrutto'),
  };
}

/** Throws a descriptive error if the columns the app actually needs (EK, VK, and at least
 *  one of EAN/HAN to match rows by) can't be found — either as a user-chosen override or under
 *  any registered format's header names. Checks across ALL formats, not just the detected one,
 *  so a file that mixes header conventions from different exports still passes as long as every
 *  field is found somewhere. */
export function assertJTLColumnsPresent(headers: string[], overrides: JTLColumnOverrides = {}): void {
  const missing: string[] = [];
  for (const field of ['ekNettoLieferant', 'vkBrutto'] as const) {
    const override = overrides[field];
    const ok = override ? headerListHasAny(headers, [override]) : headerListHasAny(headers, allCandidates(field));
    if (!ok) missing.push(CORE_FIELD_LABELS[field]);
  }
  const hasEan = overrides.eanBarcode
    ? headerListHasAny(headers, [overrides.eanBarcode])
    : headerListHasAny(headers, allCandidates('eanBarcode'));
  const hasHan = overrides.han
    ? headerListHasAny(headers, [overrides.han])
    : headerListHasAny(headers, allCandidates('han'));
  if (!hasEan && !hasHan) missing.push('EAN oder HAN');

  if (missing.length > 0) {
    throw new Error(
      `JTL-Export: Benötigte Spalte(n) nicht gefunden: ${missing.join(', ')}. ` +
      `Gefundene Spalten in der Datei: ${headers.join(', ') || '(keine)'}. ` +
      `Unterstützte Formate: ${JTL_FORMATS.map(f => f.label).join(', ')}.`
    );
  }
}
