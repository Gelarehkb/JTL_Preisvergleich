export type IdentifierType = 'HAN' | 'EAN';

export interface NewPriceRow {
  sku: string;
  /** null = cell was empty, exclude from comparison */
  newEK: number | null;
  /** null = cell was empty, exclude from comparison */
  newVK: number | null;
}

export interface JTLRow {
  internerSchluessel: string;
  artikelnummer: string;
  eanBarcode: string;
  han: string;
  artikelname: string;
  /** null when column missing or cell empty */
  ekNettoLieferant: number | null;
  /** null when column missing or cell empty */
  vkBrutto: number | null;
  warengruppe: string;
  hersteller: string;
  imZulauf: string;
  bestandGesamt: number;
  bestandKG: number | null;
  bestandNG: number;
}

export interface PriceChangeRow {
  internerSchluessel: string;
  identifierType: IdentifierType;
  identifierValue: string;
  oldEK: number | null;
  newEK: number | null;
  oldVK: number | null;
  newVK: number | null;
  vkDifference: number | null;
}

export interface StockNGRow extends PriceChangeRow {
  bestandNG: number;
}

export interface StockKGRow extends PriceChangeRow {
  bestandKG: number;
}

/** Warnings surfaced to the user after comparison */
export interface ComparisonWarning {
  type: 'duplicate_key' | 'invalid_row';
  message: string;
}
