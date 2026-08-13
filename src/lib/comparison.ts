import Decimal from 'decimal.js';
import type { IdentifierType, NewPriceRow, JTLRow, ComparisonResultRow, UnmatchedRow, UnmatchedJTLRow } from './types';

export interface ComparisonResult {
  /** All matched rows (changed AND unchanged) */
  rows: ComparisonResultRow[];
  /** Input rows with no JTL match */
  unmatchedRows: UnmatchedRow[];
  /** JTL rows with no input match */
  unmatchedJTLRows: UnmatchedJTLRow[];
  /** Duplicate identifiers found in JTL (first occurrence kept) */
  duplicateIdentifiers: string[];
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Normalize identifier based on type.
 * HAN: trim whitespace only.
 * EAN: extract leading digit sequence to strip trailing text like "inaktiv".
 * No leading-zero stripping. No number casting.
 */
function normalizeKey(value: string, identifierType: IdentifierType): string {
  if (identifierType === 'EAN') {
    const match = value.trim().match(/^\d+/);
    return match ? match[0] : value.trim();
  }
  return value.trim();
}

/**
 * Normalize HAN for fallback matching by removing trailing status markers
 * like "OP" / "DC" / "NA". Exact HAN match is always preferred first — this
 * is only used when no exact match exists, so a discontinued/relabeled row
 * (e.g. "1234 OP") still matches an incoming "1234" instead of being treated
 * as a brand-new item.
 */
function normalizeHanFallbackKey(value: string): string {
  return value
    .trim()
    .replace(/(?:[\s\-_]+(?:OP|DC|NA))+\s*$/i, '')
    .trim();
}

// Round to 2dp before comparing — prices are always displayed at 2dp and XLSX
// floats can carry sub-cent noise (e.g. 554.1199999...) that must be ignored.
const DP = 2;

function decimalEq(a: number, b: number): boolean {
  return new Decimal(a).toDecimalPlaces(DP).eq(new Decimal(b).toDecimalPlaces(DP));
}

function decimalSub(a: number, b: number): number {
  return new Decimal(a).toDecimalPlaces(DP).minus(new Decimal(b).toDecimalPlaces(DP)).toNumber();
}

/**
 * Compare a JTL export against manually entered new prices.
 *
 * Throws on duplicate identifiers in JTL for the chosen mode.
 * Returns ALL matched rows (not only changed ones).
 * Null new prices mean "no update provided" — rows are never skipped.
 */
export function compareItems(
  newPrices: NewPriceRow[],
  jtlRows: JTLRow[],
  identifierType: IdentifierType
): ComparisonResult {
  // ── Step 1: Build lookup map with strict duplicate detection ──
  const jtlMap = new Map<string, JTLRow>();
  const keyCounts = new Map<string, number>();
  const fallbackKeyCounts = new Map<string, number>();
  const fallbackKeyFirstRow = new Map<string, JTLRow>();

  for (const row of jtlRows) {
    const rawKey = identifierType === 'HAN' ? row.han : row.eanBarcode;
    if (!rawKey) continue;
    const key = normalizeKey(rawKey, identifierType);
    if (!key) continue;

    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);

    if (!jtlMap.has(key)) {
      jtlMap.set(key, row);
    }

    if (identifierType === 'HAN') {
      const fallbackKey = normalizeHanFallbackKey(key);
      if (!fallbackKey) continue;
      fallbackKeyCounts.set(fallbackKey, (fallbackKeyCounts.get(fallbackKey) ?? 0) + 1);
      if (!fallbackKeyFirstRow.has(fallbackKey)) {
        fallbackKeyFirstRow.set(fallbackKey, row);
      }
    }
  }

  // Build fallback HAN map: prefer unique matches, but for ambiguous base HANs
  // (e.g. both "1234 OP" and "1234 DC" exist) still return the first row rather
  // than leaving the new-price entry unmatched. A warning is emitted below.
  const hanFallbackMap = new Map<string, JTLRow>();
  const ambiguousFallbackKeys: string[] = [];
  if (identifierType === 'HAN') {
    for (const [key, count] of fallbackKeyCounts) {
      const row = fallbackKeyFirstRow.get(key);
      if (row) hanFallbackMap.set(key, row);
      if (count > 1) ambiguousFallbackKeys.push(key);
    }
  }

  // Collect duplicates as warning (do not throw)
  const duplicateIdentifiers: string[] = [];
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      duplicateIdentifiers.push(key);
    }
  }
  if (duplicateIdentifiers.length > 0) {
    console.warn(
      `[compareItems] Duplikate im JTL Export gefunden. Erste Vorkommen wurden verwendet.`,
      `totalDuplicates: ${duplicateIdentifiers.length}`,
      `first 10:`, duplicateIdentifiers.slice(0, 10)
    );
  }

  if (ambiguousFallbackKeys.length > 0) {
    console.warn(
      `[compareItems] Mehrdeutige HAN-Basiswerte für OP/DC/NA-Fallback gefunden. Fallback für diese Schlüssel übersprungen.`,
      `totalAmbiguousFallbackKeys: ${ambiguousFallbackKeys.length}`,
      `first 10:`, ambiguousFallbackKeys.slice(0, 10)
    );
  }

  // ── Step 2: Match and compare ──
  const rows: ComparisonResultRow[] = [];
  const unmatchedRows: UnmatchedRow[] = [];
  const matchedJTLInternerSchluessel = new Set<string>();

  const resolveJTLMatch = (sku: string): JTLRow | undefined => {
    const key = normalizeKey(sku, identifierType);
    const exact = jtlMap.get(key);
    if (exact) return exact;

    if (identifierType !== 'HAN') return undefined;
    const fallbackKey = normalizeHanFallbackKey(key);
    if (!fallbackKey) return undefined;
    return hanFallbackMap.get(fallbackKey);
  };

  for (const np of newPrices) {
    const jtl = resolveJTLMatch(np.sku);

    if (!jtl) {
      unmatchedRows.push({
        identifier: np.sku,
        newEK: np.newEK,
        newVK: np.newVK,
        rawRow: np.rawRow,
        ekColumnName: np.ekColumnName,
      });
      continue;
    }

    matchedJTLInternerSchluessel.add(jtl.internerSchluessel);

    // EK comparison
    const oldEK = jtl.ekNettoLieferant;
    const newEK = np.newEK;
    let deltaEK: number | null = null;
    let changedEK = false;

    if (newEK !== null) {
      if (oldEK !== null) {
        deltaEK = decimalSub(newEK, oldEK);
        changedEK = !decimalEq(newEK, oldEK);
      } else {
        // oldEK is null, newEK is provided → considered a change
        deltaEK = null;
        changedEK = true;
      }
    }
    // newEK === null → no update, changedEK stays false

    // VK comparison
    const oldVK = jtl.vkBrutto;
    const newVK = np.newVK;
    let deltaVK: number | null = null;
    let changedVK = false;

    if (newVK !== null) {
      if (oldVK !== null) {
        deltaVK = decimalSub(newVK, oldVK);
        changedVK = !decimalEq(newVK, oldVK);
      } else {
        deltaVK = null;
        changedVK = true;
      }
    }

    rows.push({
      internerSchluessel: jtl.internerSchluessel,
      artikelnummer: jtl.artikelnummer,
      identifier: np.sku,
      identifierType,
      oldEK,
      newEK,
      deltaEK,
      changedEK,
      oldVK,
      newVK,
      deltaVK,
      changedVK,
      lieferant: jtl.lieferant,
      imZulauf: jtl.imZulauf,
      bestandGesamt: jtl.bestandGesamt,
      bestandKG: jtl.bestandKG,
      bestandNG: jtl.bestandNG,
    });
  }

  // ── Step 3: Collect unmatched JTL rows ──
  const unmatchedJTLRows: UnmatchedJTLRow[] = [];
  for (const [key, jtl] of jtlMap) {
    if (!matchedJTLInternerSchluessel.has(jtl.internerSchluessel)) {
      unmatchedJTLRows.push({
        internerSchluessel: jtl.internerSchluessel,
        artikelnummer: jtl.artikelnummer,
        identifier: key,
        lieferant: jtl.lieferant,
        bestandKG: jtl.bestandKG,
        bestandNG: jtl.bestandNG,
        imZulauf: jtl.imZulauf,
        bestandGesamt: jtl.bestandGesamt,
      });
    }
  }

  // ── Step 4: Vater/SET parent article rule ──
  // Parent articles (han === 'Vater'/'SET' or empty EAN) are never in the price list,
  // so they always appear as unmatched. Include them in DC/EAN only if ALL their children
  // (identified by Artikelnummer prefix) are also being deactivated.
  // Do NOT include them if any child is still active — deactivating a Vater cascades to children.

  const isVater = (jtl: JTLRow): boolean => {
    return jtl.han.trim().toLowerCase() === 'vater' || jtl.eanBarcode.trim() === '';
  };

  const findChildren = (vater: JTLRow): JTLRow[] => {
    // Primary: Artikelnummer prefix (when Artikelnummer is populated)
    if (vater.artikelnummer.trim()) {
      return jtlRows.filter(r =>
        r !== vater &&
        r.artikelnummer.startsWith(vater.artikelnummer) &&
        r.artikelnummer.length > vater.artikelnummer.length
      );
    }
    // Fallback: Artikelname prefix (e.g. JTL exports where Artikelnummer is empty)
    if (vater.artikelname.trim()) {
      return jtlRows.filter(r =>
        r !== vater &&
        !isVater(r) &&
        r.artikelname.startsWith(vater.artikelname) &&
        r.artikelname.length > vater.artikelname.length
      );
    }
    return [];
  };

  const unmatchedInternerSchluessel = new Set(unmatchedJTLRows.map(r => r.internerSchluessel));
  const vaterToAdd: UnmatchedJTLRow[] = [];
  const vaterToRemove = new Set<string>(); // internerSchluessel
  const processedVater = new Set<string>();

  for (const jtl of jtlRows) {
    if (!isVater(jtl)) continue;
    if (processedVater.has(jtl.internerSchluessel)) continue;
    processedVater.add(jtl.internerSchluessel);

    const children = findChildren(jtl);
    if (children.length === 0) {
      // No children found by prefix — leave as-is (orphan Vater, keep if in list)
      continue;
    }

    const allChildrenUnmatched = children.every(c => unmatchedInternerSchluessel.has(c.internerSchluessel));
    const alreadyInList = unmatchedJTLRows.some(r => r.internerSchluessel === jtl.internerSchluessel);

    if (allChildrenUnmatched) {
      if (!alreadyInList) {
        vaterToAdd.push({
          internerSchluessel: jtl.internerSchluessel,
          artikelnummer: jtl.artikelnummer,
          identifier: jtl.internerSchluessel,
          lieferant: jtl.lieferant,
          bestandKG: jtl.bestandKG,
          bestandNG: jtl.bestandNG,
          imZulauf: jtl.imZulauf,
          bestandGesamt: jtl.bestandGesamt,
        });
      }
    } else {
      // At least one child is still active → Vater must not be deactivated
      if (alreadyInList) vaterToRemove.add(jtl.internerSchluessel);
    }
  }

  const finalUnmatchedJTLRows = [
    ...unmatchedJTLRows.filter(r => !vaterToRemove.has(r.internerSchluessel)),
    ...vaterToAdd,
  ];

  // Diagnostics
  console.log('[compareItems] total JTL rows:', jtlRows.length, 'total new rows:', newPrices.length);
  console.log('[compareItems] matched:', rows.length, 'unmatched:', unmatchedRows.length, 'unmatchedJTL:', unmatchedJTLRows.length);
  if (unmatchedRows.length > 0) {
    console.log('[compareItems] first unmatched:', unmatchedRows.slice(0, 5).map(r => r.identifier));
  }
  console.log('[compareItems] first 3 JTL keys:', Array.from(jtlMap.keys()).slice(0, 3));
  console.log('[compareItems] first 3 new keys:', newPrices.slice(0, 3).map(np => normalizeKey(np.sku, identifierType)));

  return {
    rows,
    unmatchedRows,
    unmatchedJTLRows: finalUnmatchedJTLRows,
    duplicateIdentifiers,
    matchedCount: rows.length,
    unmatchedCount: unmatchedRows.length,
  };
}
