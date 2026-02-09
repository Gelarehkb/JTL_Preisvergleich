import { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { ColumnMapper } from '@/components/ColumnMapper';
import { ResultsPanel } from '@/components/ResultsPanel';
import { parseNewPrices, parseJTL, getColumnHeaders } from '@/lib/parseFiles';
import { compareItems, type ComparisonResult } from '@/lib/comparison';
import type { IdentifierType, NewPriceRow, JTLRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('HAN');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [jtlFile, setJtlFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [skuCol, setSkuCol] = useState('');
  const [ekCol, setEkCol] = useState('');
  const [vkCol, setVkCol] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNewFile = useCallback(async (file: File) => {
    setNewFile(file);
    setResult(null);
    try {
      const cols = await getColumnHeaders(file);
      setHeaders(cols);
      // Auto-detect columns
      setSkuCol(cols.find(c => /sku|han|ean|barcode|identifier/i.test(c)) ?? cols[0] ?? '');
      setEkCol(cols.find(c => /ek|einkauf|purchase/i.test(c)) ?? cols[1] ?? '');
      setVkCol(cols.find(c => /vk|verkauf|selling|retail/i.test(c)) ?? cols[2] ?? '');
    } catch {
      toast.error('Fehler beim Lesen der Datei');
    }
  }, []);

  const handleCompare = useCallback(async () => {
    if (!newFile || !jtlFile || !skuCol || !ekCol || !vkCol) return;
    setLoading(true);
    try {
      const [newPrices, { rows: jtlRows }] = await Promise.all([
        parseNewPrices(newFile, skuCol, ekCol, vkCol),
        parseJTL(jtlFile),
      ]);
      const res = compareItems(newPrices, jtlRows, identifierType);
      setResult(res);
      toast.success(`${res.priceChanges.length} Preisänderungen gefunden`);
    } catch (err) {
      toast.error('Fehler beim Vergleich: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [newFile, jtlFile, skuCol, ekCol, vkCol, identifierType]);

  const canCompare = newFile && jtlFile && skuCol && ekCol && vkCol;

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
        {/* Identifier Toggle */}
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
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* File Uploads */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <FileUploadZone
              label="Neue Preisliste"
              description="Excel oder CSV mit SKU, EK, VK"
              accept=".csv,.xlsx,.xls"
              file={newFile}
              onFile={handleNewFile}
              onClear={() => { setNewFile(null); setHeaders([]); setResult(null); }}
            />
            {headers.length > 0 && (
              <ColumnMapper
                headers={headers}
                skuColumn={skuCol}
                ekColumn={ekCol}
                vkColumn={vkCol}
                onSkuChange={setSkuCol}
                onEkChange={setEkCol}
                onVkChange={setVkCol}
              />
            )}
          </div>
          <FileUploadZone
            label="JTL Export"
            description="CSV mit Interner Schlüssel, HAN, EAN, EK, VK…"
            accept=".csv"
            file={jtlFile}
            onFile={(f) => { setJtlFile(f); setResult(null); }}
            onClear={() => { setJtlFile(null); setResult(null); }}
          />
        </div>

        {/* Compare Button */}
        <div className="flex justify-center">
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

        {/* Results */}
        {result && <ResultsPanel result={result} />}
      </main>
    </div>
  );
};

export default Index;
