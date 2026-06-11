import { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { EditableTable, type TableRow } from '@/components/EditableTable';
import { ResultsPanel } from '@/components/ResultsPanel';
import { ColumnMapper } from '@/components/ColumnMapper';
import { PreviewTable } from '@/components/PreviewTable';
import { parseJTL, parseNewPrices, getPreviewData, type PreviewData } from '@/lib/parseFiles';
import { compareItems, type ComparisonResult } from '@/lib/comparison';
import type { IdentifierType, NewPriceRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

function guessColumn(headers: string[], patterns: RegExp[]): string {
  for (const p of patterns) {
    const hit = headers.find(h => p.test(h));
    if (hit) return hit;
  }
  return '';
}

/** Returns null for empty strings so empty cells aren't treated as 0 */
function parseNumber(val: string): number | null {
  if (!val.trim()) return null;
  const str = val.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function createInitialRows(): TableRow[] {
  let id = 0;
  return Array.from({ length: 5 }, () => ({
    id: `init-${++id}`,
    identifier: '',
    newEK: '',
    newVK: '',
  }));
}

type CsvSlot = 1 | 2;

const Index = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('HAN');
  const [tableRows, setTableRows] = useState<TableRow[]>(createInitialRows);
  const [jtlFile, setJtlFile] = useState<File | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPriceCsvFile1, setNewPriceCsvFile1] = useState<File | null>(null);
  const [newPriceCsvFile2, setNewPriceCsvFile2] = useState<File | null>(null);
  const [slotRows1, setSlotRows1] = useState<NewPriceRow[] | null>(null);
  const [slotRows2, setSlotRows2] = useState<NewPriceRow[] | null>(null);
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
  const [pendingSlot, setPendingSlot] = useState<CsvSlot>(1);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingPreview, setPendingPreview] = useState<PreviewData | null>(null);
  const [mapSku, setMapSku] = useState('');
  const [mapEk, setMapEk] = useState('');
  const [mapVk, setMapVk] = useState('');
  const [showColumnDialog, setShowColumnDialog] = useState(false);

  const filledRows = tableRows.filter(r => r.identifier.trim() !== '');

  /** Merge rows from up to two slots by identifier; first non-null wins per field. */
  const mergeSlots = useCallback((a: NewPriceRow[] | null, b: NewPriceRow[] | null): NewPriceRow[] => {
    const map = new Map<string, NewPriceRow>();
    const order: string[] = [];
    const add = (rows: NewPriceRow[] | null) => {
      if (!rows) return;
      for (const r of rows) {
        const key = r.sku.trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { sku: r.sku, newEK: r.newEK, newVK: r.newVK, rawRow: r.rawRow });
          order.push(key);
        } else {
          if (existing.newEK === null && r.newEK !== null) existing.newEK = r.newEK;
          if (existing.newVK === null && r.newVK !== null) existing.newVK = r.newVK;
          if (!existing.rawRow && r.rawRow) existing.rawRow = r.rawRow;
        }
      }
    };
    add(a);
    add(b);
    return order.map(k => map.get(k)!);
  }, []);

  const applyMerged = useCallback((merged: NewPriceRow[]) => {
    if (merged.length === 0) {
      setTableRows(createInitialRows());
      setResult(null);
      return;
    }
    const imported: TableRow[] = merged.map((r, i) => ({
      id: `csv-${Date.now()}-${i}`,
      identifier: r.sku,
      newEK: r.newEK !== null ? String(r.newEK).replace('.', ',') : '',
      newVK: r.newVK !== null ? String(r.newVK).replace('.', ',') : '',
    }));
    setTableRows(imported);
    setResult(null);
  }, []);

  const importCsvRows = useCallback(async (file: File, slot: CsvSlot, sku: string, ek: string, vk: string) => {
    try {
      const parsed = await parseNewPrices(file, sku, ek, vk);
      if (parsed.length === 0) {
        toast.error('Keine gültigen Zeilen in der CSV gefunden');
        return;
      }
      let next1 = slotRows1;
      let next2 = slotRows2;
      if (slot === 1) { next1 = parsed; setSlotRows1(parsed); setNewPriceCsvFile1(file); }
      else { next2 = parsed; setSlotRows2(parsed); setNewPriceCsvFile2(file); }
      const merged = mergeSlots(next1, next2);
      applyMerged(merged);
      const dualMsg = next1 && next2 ? ` (${merged.length} nach Zusammenführung)` : '';
      toast.success(`${parsed.length} Zeilen importiert${dualMsg}`);
    } catch (err) {
      toast.error('CSV Fehler: ' + (err as Error).message);
    }
  }, [slotRows1, slotRows2, mergeSlots, applyMerged]);

  /** Open column-mapping dialog whenever a price-list CSV is uploaded */
  const handleNewPriceCsv = useCallback(async (file: File, slot: CsvSlot) => {
    try {
      const preview = await getPreviewData(file, 20);
      const headers = preview.headers;
      if (headers.length < 1) {
        toast.error('CSV enthält keine Spalten');
        return;
      }
      const idPatterns = identifierType === 'EAN'
        ? [/ean/i, /barcode/i, /gtin/i]
        : [/\bhan\b/i, /hersteller.*nummer/i, /mpn/i, /art.*nr/i, /sku/i];
      setPendingCsvFile(file);
      setPendingSlot(slot);
      setPendingHeaders(headers);
      setPendingPreview(preview);
      setMapSku(guessColumn(headers, idPatterns) || headers[0]);
      setMapEk(guessColumn(headers, [/^ek/i, /einkauf/i, /\bek\b/i]));
      setMapVk(guessColumn(headers, [/^vk/i, /verkauf/i, /\bvk\b/i, /preis/i]));
      setShowColumnDialog(true);
    } catch (err) {
      toast.error('CSV Fehler: ' + (err as Error).message);
    }
  }, [identifierType]);

  const handleConfirmMapping = useCallback(async () => {
    if (!pendingCsvFile || !mapSku) return;
    if (!mapEk && !mapVk) {
      toast.error('Bitte mindestens EK oder VK Spalte zuordnen');
      return;
    }
    setShowColumnDialog(false);
    await importCsvRows(pendingCsvFile, pendingSlot, mapSku, mapEk, mapVk);
    setPendingCsvFile(null);
  }, [pendingCsvFile, pendingSlot, mapSku, mapEk, mapVk, importCsvRows]);

  const clearSlot = useCallback((slot: CsvSlot) => {
    let next1 = slotRows1;
    let next2 = slotRows2;
    if (slot === 1) { next1 = null; setSlotRows1(null); setNewPriceCsvFile1(null); }
    else { next2 = null; setSlotRows2(null); setNewPriceCsvFile2(null); }
    const merged = mergeSlots(next1, next2);
    applyMerged(merged);
  }, [slotRows1, slotRows2, mergeSlots, applyMerged]);

  const handleCompare = useCallback(async () => {
    if (filledRows.length === 0 || !jtlFile) return;
    setLoading(true);
    try {
      const newPrices: NewPriceRow[] = filledRows.map(r => ({
        sku: r.identifier.trim(),
        newEK: parseNumber(r.newEK),
        newVK: parseNumber(r.newVK),
      }));

      const { rows: jtlRows } = await parseJTL(jtlFile);
      const res = compareItems(newPrices, jtlRows, identifierType);
      setResult(res);
      const changedCount = res.rows.filter(r => r.changedEK || r.changedVK).length;
      if (res.duplicateIdentifiers.length > 0) {
        toast.warning(`${res.duplicateIdentifiers.length} Duplikate im JTL Export gefunden. Erste Vorkommen wurden verwendet.`);
      }
      toast.success(`${res.matchedCount} zugeordnet, ${changedCount} Änderungen${res.unmatchedCount > 0 ? `, ${res.unmatchedCount} nicht gefunden` : ''}`);
    } catch (err) {
      toast.error('Fehler beim Vergleich: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filledRows, jtlFile, identifierType]);

  const canCompare = filledRows.length > 0 && jtlFile;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Preisvergleich</h1>
            <p className="text-xs text-muted-foreground">JTL Export vs. Neue Preisliste</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {/* Top Bar: Identifier Toggle + Compare Button */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Zuordnung über:</span>
            <div className="inline-flex rounded-lg border bg-muted p-0.5">
              {(['HAN', 'EAN'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setIdentifierType(type); setResult(null); }}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    identifierType === type
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {type === 'EAN' ? 'EAN Barcode' : 'HAN'}
                </button>
              ))}
            </div>
          </div>
          <Button
            size="lg"
            disabled={!canCompare || loading}
            onClick={handleCompare}
            className="gap-2 px-8"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {loading ? 'Vergleiche…' : 'Vergleichen'}
          </Button>
        </div>

        {/* JTL Export Upload */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">JTL Export</h2>
          <FileUploadZone
            label="JTL Export hochladen"
            description="CSV mit Interner Schlüssel, HAN, EAN, EK, VK…"
            accept=".csv"
            file={jtlFile}
            onFile={(f) => { setJtlFile(f); setResult(null); }}
            onClear={() => { setJtlFile(null); setResult(null); }}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Neue Preisliste</h2>
          <p className="text-xs text-muted-foreground">
            Eine Datei mit EK & VK – oder zwei Dateien, die per {identifierType} zusammengeführt werden.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FileUploadZone
              label="Preisliste 1"
              description={`CSV/XLSX mit ${identifierType} + EK und/oder VK`}
              accept=".csv,.xlsx,.xls"
              file={newPriceCsvFile1}
              onFile={(f) => handleNewPriceCsv(f, 1)}
              onClear={() => clearSlot(1)}
            />
            <FileUploadZone
              label="Preisliste 2 (optional)"
              description={`Zweite Datei – wird per ${identifierType} mit Preisliste 1 zusammengeführt`}
              accept=".csv,.xlsx,.xls"
              file={newPriceCsvFile2}
              onFile={(f) => handleNewPriceCsv(f, 2)}
              onClear={() => clearSlot(2)}
            />
          </div>

          <EditableTable
            identifierType={identifierType}
            rows={tableRows}
            onChange={(rows) => { setTableRows(rows); setResult(null); }}
          />
        </section>

        {/* Results */}
        {result && <ResultsPanel result={result} />}
      </main>

      {/* Column mapping dialog */}
      <Dialog open={showColumnDialog} onOpenChange={(open) => { if (!open) { setShowColumnDialog(false); setPendingCsvFile(null); setPendingPreview(null); } }}>
        <DialogContent className="max-w-[min(96vw,1100px)] sm:max-w-[min(96vw,1100px)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Spalten zuordnen</DialogTitle>
            <DialogDescription>
              Wähle aus, welche Spalte den Identifier ({identifierType}), den neuen EK und den neuen VK enthält.
              {pendingPreview && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (Trennzeichen: <code>{pendingPreview.delimiter === '\t' ? '\\t' : pendingPreview.delimiter}</code>, Dezimal: <code>{pendingPreview.decimal}</code>)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ColumnMapper
            headers={pendingHeaders}
            skuColumn={mapSku}
            ekColumn={mapEk}
            vkColumn={mapVk}
            onSkuChange={setMapSku}
            onEkChange={setMapEk}
            onVkChange={setMapVk}
            identifierLabel={identifierType === 'EAN' ? 'EAN / Barcode' : 'HAN'}
          />
          {pendingPreview && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Vorschau (erste {pendingPreview.rows.length} Zeilen) — Spalten lassen sich am rechten Rand ziehen
              </p>
              <PreviewTable headers={pendingPreview.headers} rows={pendingPreview.rows} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowColumnDialog(false); setPendingCsvFile(null); setPendingPreview(null); }}>Abbrechen</Button>
            <Button onClick={handleConfirmMapping} disabled={!mapSku || (!mapEk && !mapVk)}>Übernehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
