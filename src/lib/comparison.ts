import type { IdentifierType, NewPriceRow, JTLRow, PriceChangeRow, StockNGRow, StockKGRow, ComparisonWarning } from './types';

export interface ComparisonResult {
  priceChanges: PriceChangeRow[];
  stockNG: StockNGRow[];
  stockKG: StockKGRow[];
  matchedCount: number;
  skippedCount: number;
  unmatchedCount: number;
  /** Rows excluded because both EK and VK were null in the new price list */
  invalidRowCount: number;
  /** Count of matched rows where JTL EK was null */
  missingJtlEkCount: number;
  /** Count of matched rows where JTL VK was null */
  missingJtlVkCount: number;
  warnings: ComparisonWarning[];
}

/**
 * Tolerance for price comparison: 0.005
 * This aligns with 2-decimal rounding — a difference < 0.005 rounds to 0.00
 * and is therefore not a real cent-level change.
 */
const PRICE_TOLERANCE = 0.005;

/**
 * Normalize identifier strings for matching:
 * - Trim whitespace
 * - For EAN: strip leading zeros so "0012345" matches "12345"
 */
function normalizeKey(value: string, type: IdentifierType): string {
  const trimmed = value.trim();
  if (type === 'EAN' && /^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+/, '') || '0';
  }
  return trimmed;
}

/** Round to 2 decimals to eliminate float precision artifacts */
function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Nullable XOR comparison with rounding:
 * - both null → false (no change)
 * - exactly one null → true (change)
 * - both present → round both, then |a-b| > tolerance (strict >)
 */
function pricesChanged(oldVal: number | null, newVal: number | null): boolean {
  if (oldVal === null && newVal === null) return false;
  if (oldVal === null || newVal === null) return true;
  return Math.abs(round2(newVal) - round2(oldVal)) > PRICE_TOLERANCE;
}

function roundPrice(val: number | null): number | null {
  if (val === null) return null;
  return Math.round(val * 100) / 100;
}

export function compareItems(
  newPrices: NewPriceRow[],
  jtlRows: JTLRow[],
  identifierType: IdentifierType
): ComparisonResult {
  const warnings: ComparisonWarning[] = [];

  // Build lookup map with duplicate detection
  const jtlMap = new Map<string, JTLRow>();
  const seenKeys = new Map<string, number>();

  for (const row of jtlRows) {
    const rawKey = identifierType === 'HAN' ? row.han : row.eanBarcode;
    if (!rawKey) continue;
    const key = normalizeKey(rawKey, identifierType);
    if (!key) continue;

    const count = (seenKeys.get(key) ?? 0) + 1;
    seenKeys.set(key, count);

    if (count === 2) {
      warnings.push({
        type: 'duplicate_key',
        message: `Duplikat ${identifierType} "${rawKey}" im JTL Export (${count}+ Zeilen). Nur die erste Zeile wird verwendet.`,
      });
    }

    // Keep first occurrence only
    if (!jtlMap.has(key)) {
      jtlMap.set(key, row);
    }
  }

  const priceChanges: PriceChangeRow[] = [];
  let matchedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  let invalidRowCount = 0;
  let missingJtlEkCount = 0;
  let missingJtlVkCount = 0;

  const unmatchedIdentifiers: string[] = [];

  for (const np of newPrices) {
    // Skip rows where both EK and VK are null (empty input)
    if (np.newEK === null && np.newVK === null) {
      invalidRowCount++;
      continue;
    }

    const newKey = normalizeKey(np.sku, identifierType);
    const jtl = jtlMap.get(newKey);

    if (!jtl) {
      unmatchedCount++;
      if (unmatchedIdentifiers.length < 5) {
        unmatchedIdentifiers.push(np.sku);
      }
      continue;
    }

    matchedCount++;

    // Track missing JTL prices
    if (jtl.ekNettoLieferant === null) missingJtlEkCount++;
    if (jtl.vkBrutto === null) missingJtlVkCount++;

    // XOR-based comparison: both null=false, one null=true, both present=tolerance check
    const ekChanged = pricesChanged(jtl.ekNettoLieferant, np.newEK);
    const vkChanged = pricesChanged(jtl.vkBrutto, np.newVK);

    if (!ekChanged && !vkChanged) {
      skippedCount++;
      continue;
    }

    const vkDiff =
      np.newVK !== null && jtl.vkBrutto !== null
        ? roundPrice(np.newVK - jtl.vkBrutto)
        : null;

    priceChanges.push({
      internerSchluessel: jtl.internerSchluessel,
      identifierType,
      identifierValue: np.sku,
      oldEK: jtl.ekNettoLieferant,
      newEK: np.newEK,
      oldVK: jtl.vkBrutto,
      newVK: np.newVK,
      vkDifference: vkDiff,
    });
  }

  // Temporary diagnostics
  console.log('[compareItems] matchedCount:', matchedCount, 'unmatchedCount:', unmatchedCount, 'priceChanges:', priceChanges.length);
  if (unmatchedIdentifiers.length > 0) {
    console.log('[compareItems] first unmatched identifiers:', unmatchedIdentifiers);
  }

  // Build stock-filtered lists
  const stockNG: StockNGRow[] = [];
  const stockKG: StockKGRow[] = [];

  for (const pc of priceChanges) {
    const key = normalizeKey(pc.identifierValue, identifierType);
    const jtl = jtlMap.get(key)!;
    if (jtl.bestandNG > 0) {
      stockNG.push({ ...pc, bestandNG: jtl.bestandNG });
    }
    if (jtl.bestandKG !== null && jtl.bestandKG > 0) {
      stockKG.push({ ...pc, bestandKG: jtl.bestandKG });
    }
  }

  return { priceChanges, stockNG, stockKG, matchedCount, skippedCount, unmatchedCount, invalidRowCount, missingJtlEkCount, missingJtlVkCount, warnings };
}
