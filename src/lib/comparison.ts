import Decimal from 'decimal.js';
import type { IdentifierType, NewPriceRow, JTLRow, ComparisonResultRow, UnmatchedRow } from './types';

export interface ComparisonResult {
  /** All matched rows (changed AND unchanged) */
  rows: ComparisonResultRow[];
  /** Input rows with no JTL match */
  unmatchedRows: UnmatchedRow[];
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Normalize identifier: trim whitespace only.
 * No leading-zero stripping. No number casting.
 */
function trimKey(value: string): string {
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
    const key = trimKey(rawKey);
    if (!key) continue;

    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);

    if (!jtlMap.has(key)) {
      jtlMap.set(key, row);
    }
  }

  // Collect duplicates and throw if any exist
  const duplicates: string[] = [];
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      duplicates.push(`${key} (${count}×)`);
    }
  }
  if (duplicates.length > 0) {
    const shown = duplicates.slice(0, 10).join(', ');
    const extra = duplicates.length > 10 ? ` und ${duplicates.length - 10} weitere` : '';
    throw new Error(
      `Duplikate im JTL Export für ${identifierType}: ${shown}${extra}. ` +
      `Bitte bereinigen Sie die JTL-Daten vor dem Vergleich.`
    );
  }

  // ── Step 2: Match and compare ──
  const rows: ComparisonResultRow[] = [];
  const unmatchedRows: UnmatchedRow[] = [];

  for (const np of newPrices) {
    const key = trimKey(np.sku);
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

  // Diagnostics
  console.log('[compareItems] matched:', rows.length, 'unmatched:', unmatchedRows.length);
  if (unmatchedRows.length > 0) {
    console.log('[compareItems] first unmatched:', unmatchedRows.slice(0, 5).map(r => r.identifier));
  }

  return {
    rows,
    unmatchedRows,
    matchedCount: rows.length,
    unmatchedCount: unmatchedRows.length,
  };
}
