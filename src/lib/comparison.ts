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

function pricesChanged(oldVal: number | null, newVal: number | null): boolean | null {
  // If new value is null, we can't compare — skip this dimension
  if (newVal === null) return null;
  // If old value is null but new is provided, that's a change
  if (oldVal === null) return true;
  return Math.abs(newVal - oldVal) >= PRICE_TOLERANCE;
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
        message: `Duplicate ${identifierType} "${rawKey}" in JTL export (${count}+ rows). Only the last occurrence is used.`,
      });
    }

    jtlMap.set(key, row);
  }

  const priceChanges: PriceChangeRow[] = [];
  let matchedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  let invalidRowCount = 0;

  for (const np of newPrices) {
    // Skip rows where both EK and VK are null (empty input)
    if (np.newEK === null && np.newVK === null) {
      invalidRowCount++;
      continue;
    }

    const key = normalizeKey(np.sku, identifierType);
    const jtl = jtlMap.get(key);

    if (!jtl) {
      unmatchedCount++;
      continue;
    }

    matchedCount++;

    const ekResult = pricesChanged(jtl.ekNettoLieferant, np.newEK);
    const vkResult = pricesChanged(jtl.vkBrutto, np.newVK);

    // If all comparable dimensions are unchanged, skip
    // null result means "not comparable" — we only skip if ALL results are false or null,
    // and at least one was explicitly false (i.e., compared and equal)
    const hasChange = ekResult === true || vkResult === true;
    const hasComparison = ekResult !== null || vkResult !== null;

    if (!hasChange && hasComparison) {
      skippedCount++;
      continue;
    }

    // If neither dimension was comparable (both null), skip as invalid
    if (!hasComparison) {
      invalidRowCount++;
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

  return { priceChanges, stockNG, stockKG, matchedCount, skippedCount, unmatchedCount, invalidRowCount, warnings };
}
