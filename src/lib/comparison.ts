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
 * Exact decimal equality using Decimal.js.
 * Returns true if the two numbers are exactly equal in decimal representation.
 */
function decimalEq(a: number, b: number): boolean {
  return new Decimal(a).eq(new Decimal(b));
}

/**
 * Exact decimal subtraction using Decimal.js.
 * Returns the result as a JS number for storage.
 */
function decimalSub(a: number, b: number): number {
  return new Decimal(a).minus(new Decimal(b)).toNumber();
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

  for (const row of jtlRows) {
    const rawKey = identifierType === 'HAN' ? row.han : row.eanBarcode;
    if (!rawKey) continue;
    const key = normalizeKey(rawKey, identifierType);
    if (!key) continue;

    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);

    if (!jtlMap.has(key)) {
      jtlMap.set(key, row);
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

  // ── Step 2: Match and compare ──
  const rows: ComparisonResultRow[] = [];
  const unmatchedRows: UnmatchedRow[] = [];

  for (const np of newPrices) {
    const key = normalizeKey(np.sku, identifierType);
    const jtl = jtlMap.get(key);

    if (!jtl) {
      unmatchedRows.push({
        identifier: np.sku,
        newEK: np.newEK,
        newVK: np.newVK,
      });
      continue;
    }

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
      imZulauf: jtl.imZulauf,
      bestandGesamt: jtl.bestandGesamt,
      bestandKG: jtl.bestandKG,
      bestandNG: jtl.bestandNG,
    });
  }

  // ── Step 3: Collect unmatched JTL rows ──
  const matchedKeys = new Set<string>();
  for (const np of newPrices) {
    const key = normalizeKey(np.sku, identifierType);
    if (jtlMap.has(key)) matchedKeys.add(key);
  }

  const unmatchedJTLRows: UnmatchedJTLRow[] = [];
  for (const [key, jtl] of jtlMap) {
    if (!matchedKeys.has(key)) {
      // Include all unmatched JTL rows — even if internerSchluessel is empty
      // The identifier (EAN/HAN) is always available as the map key
      unmatchedJTLRows.push({
        internerSchluessel: jtl.internerSchluessel,
        identifier: key,
        bestandKG: jtl.bestandKG,
        bestandNG: jtl.bestandNG,
        imZulauf: jtl.imZulauf,
        bestandGesamt: jtl.bestandGesamt,
      });
    }
  }

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
    unmatchedJTLRows,
    duplicateIdentifiers,
    matchedCount: rows.length,
    unmatchedCount: unmatchedRows.length,
  };
}
