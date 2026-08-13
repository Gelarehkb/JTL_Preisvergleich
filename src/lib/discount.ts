import Decimal from 'decimal.js';

/** Parse a discount percent input (accepts comma or dot). Invalid/blank/≤0 → 0 (no discount). */
export function parseDiscountPercent(value: string): number {
  if (!value || !value.trim()) return 0;
  const n = parseFloat(value.trim().replace(',', '.'));
  return isNaN(n) || n <= 0 ? 0 : n;
}

/** Apply a percentage discount to an EK value, e.g. 20% → EK * 0.8. Rounded to 2dp. */
export function applyEkDiscount(value: number | null, discountPercent: number): number | null {
  if (value === null) return null;
  if (!discountPercent) return value;
  const factor = new Decimal(1).minus(new Decimal(discountPercent).div(100));
  return new Decimal(value).times(factor).toDecimalPlaces(2).toNumber();
}
