import { describe, it, expect } from 'vitest';
import { parseJTL } from './parseFiles';

function csvFile(content: string, name = 'export.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

const STANDARD_CSV = [
  'Interner Schlüssel;Artikelnummer;Artikelname;HAN;EAN;Netto-EK;Std. VK Brutto;Lieferant;Im Zulauf;Lagerbestand Gesamt',
  '1001;ART-1;Testartikel eins;HAN-1;4000000000001;10,00;19,90;Testlieferant;0,00;5,00',
  '1002;ART-2;Testartikel zwei;HAN-2;4000000000002;20,50;39,90;Testlieferant;1,00;0,00',
].join('\n');

const ARTIKELLISTE_CSV = [
  'Interner Schlüssel;Artikelnummer;Artikelname;HAN;EAN;Ø Netto-EK;Brutto-VK;Lieferant;Im Zulauf;Lagerbestand (gesamt)',
  '2001;ART-3;Testartikel drei;HAN-3;4000000000003;12,00;22,90;Anderer Lieferant;0,00;3,00',
].join('\n');

const MISSING_PRICE_COLUMNS_CSV = [
  'Interner Schlüssel;Artikelnummer;Artikelname;HAN;EAN',
  '3001;ART-4;Testartikel vier;HAN-4;4000000000004',
].join('\n');

describe('parseJTL', () => {
  it('parses the standard JTL export format', async () => {
    const { rows, formatId } = await parseJTL(csvFile(STANDARD_CSV));
    expect(formatId).toBe('standard');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      internerSchluessel: '1001',
      artikelnummer: 'ART-1',
      han: 'HAN-1',
      eanBarcode: '4000000000001',
      ekNettoLieferant: 10,
      vkBrutto: 19.9,
      lieferant: 'Testlieferant',
      bestandGesamt: 5,
    });
  });

  it('parses the Artikelliste JTL export format via Ø Netto-EK / Brutto-VK columns', async () => {
    const { rows, formatId } = await parseJTL(csvFile(ARTIKELLISTE_CSV));
    expect(formatId).toBe('artikelliste');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      internerSchluessel: '2001',
      artikelnummer: 'ART-3',
      han: 'HAN-3',
      eanBarcode: '4000000000003',
      ekNettoLieferant: 12,
      vkBrutto: 22.9,
      lieferant: 'Anderer Lieferant',
      bestandGesamt: 3,
    });
  });

  it('throws a clear error when EK/VK columns cannot be found in any known format', async () => {
    await expect(parseJTL(csvFile(MISSING_PRICE_COLUMNS_CSV))).rejects.toThrow(/EK, VK/);
  });
});
