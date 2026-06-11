export type IdentifierType = 'HAN' | 'EAN';

export interface NewPriceRow {
  sku: string;
  /** null = no update provided (not "invalid") */
  newEK: number | null;
  /** null = no update provided (not "invalid") */
  newVK: number | null;
  /** Original CSV row — present when imported from a file, absent for manual entries */
  rawRow?: Record<string, string>;
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
  lieferant: string;
  warengruppe: string;
  hersteller: string;
  imZulauf: string;
  bestandGesamt: number;
  bestandKG: number | null;
  bestandNG: number;
}

/** A single comparison result row — returned for EVERY matched input row */
export interface ComparisonResultRow {
  internerSchluessel: string;
  artikelnummer: string;
  identifier: string;
  identifierType: IdentifierType;
  oldEK: number | null;
  newEK: number | null;
  deltaEK: number | null;
  changedEK: boolean;
  oldVK: number | null;
  newVK: number | null;
  deltaVK: number | null;
  changedVK: boolean;
  lieferant: string;
  imZulauf: string;
  bestandGesamt: number;
  bestandKG: number | null;
  bestandNG: number;
}

/** An input row that could not be matched to any JTL row */
export interface UnmatchedRow {
  identifier: string;
  newEK: number | null;
  newVK: number | null;
  rawRow?: Record<string, string>;
}

/** A JTL row that was NOT matched by any input row */
export interface UnmatchedJTLRow {
  internerSchluessel: string;
  identifier: string;
  lieferant: string;
  bestandKG: number | null;
  bestandNG: number;
  imZulauf: string;
  bestandGesamt: number;
}
