import type { IdentifierType, NewPriceRow, JTLRow, PriceChangeRow, StockNGRow, StockKGRow } from './types';

export interface ComparisonResult {
  priceChanges: PriceChangeRow[];
  stockNG: StockNGRow[];
  stockKG: StockKGRow[];
  matchedCount: number;
  skippedCount: number;
  unmatchedCount: number;
}

export function compareItems(
  newPrices: NewPriceRow[],
  jtlRows: JTLRow[],
  identifierType: IdentifierType
): ComparisonResult {
  const jtlMap = new Map<string, JTLRow>();
  for (const row of jtlRows) {
    const key = identifierType === 'HAN' ? row.han : row.eanBarcode;
    if (key) jtlMap.set(key, row);
  }

  const priceChanges: PriceChangeRow[] = [];
  let matchedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;

  for (const np of newPrices) {
    const jtl = jtlMap.get(np.sku);
    if (!jtl) {
      unmatchedCount++;
      continue;
    }

    matchedCount++;

    const ekChanged = Math.abs(np.newEK - jtl.ekNettoLieferant) > 0.001;
    const vkChanged = Math.abs(np.newVK - jtl.vkBrutto) > 0.001;

    if (!ekChanged && !vkChanged) {
      skippedCount++;
      continue;
    }

    priceChanges.push({
      internerSchluessel: jtl.internerSchluessel,
      identifierType,
      identifierValue: np.sku,
      oldEK: jtl.ekNettoLieferant,
      newEK: np.newEK,
      oldVK: jtl.vkBrutto,
      newVK: np.newVK,
      vkDifference: Math.round((np.newVK - jtl.vkBrutto) * 100) / 100,
    });
  }

  const stockNG: StockNGRow[] = [];
  const stockKG: StockKGRow[] = [];

  for (const pc of priceChanges) {
    const jtl = jtlMap.get(pc.identifierValue)!;
    if (jtl.bestandNG > 0) {
      stockNG.push({ ...pc, bestandNG: jtl.bestandNG });
    }
    if (jtl.bestandKG !== null && jtl.bestandKG > 0) {
      stockKG.push({ ...pc, bestandKG: jtl.bestandKG });
    }
  }

  return { priceChanges, stockNG, stockKG, matchedCount, skippedCount, unmatchedCount };
}
