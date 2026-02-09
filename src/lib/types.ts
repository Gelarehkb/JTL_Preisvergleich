export type IdentifierType = 'HAN' | 'EAN';

export interface NewPriceRow {
  sku: string;
  newEK: number;
  newVK: number;
}

export interface JTLRow {
  internerSchluessel: string;
  artikelnummer: string;
  eanBarcode: string;
  han: string;
  artikelname: string;
  ekNettoLieferant: number;
  vkBrutto: number;
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
  oldEK: number;
  newEK: number;
  oldVK: number;
  newVK: number;
  vkDifference: number;
}

export interface StockNGRow extends PriceChangeRow {
  bestandNG: number;
}

export interface StockKGRow extends PriceChangeRow {
  bestandKG: number;
}
