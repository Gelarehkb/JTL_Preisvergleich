import { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/FileUploadZone';
import { EditableTable, type TableRow } from '@/components/EditableTable';
import { ResultsPanel } from '@/components/ResultsPanel';
import { parseJTL } from '@/lib/parseFiles';
import { compareItems, type ComparisonResult } from '@/lib/comparison';
import type { IdentifierType, NewPriceRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

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

const Index = () => {
  const [identifierType, setIdentifierType] = useState<IdentifierType>('HAN');
  const [tableRows, setTableRows] = useState<TableRow[]>(createInitialRows);
  const [jtlFile, setJtlFile] = useState<File | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const filledRows = tableRows.filter(r => r.identifier.trim() !== '');

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
      if (res.warnings.length > 0) {
        res.warnings.forEach(w => toast.warning(w.message));
      }
      toast.success(`${res.priceChanges.length} Preisänderungen gefunden${res.invalidRowCount > 0 ? ` (${res.invalidRowCount} Zeilen ohne Preise übersprungen)` : ''}`);
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

        {/* New Price List - Editable Table */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Neue Preisliste</h2>
          <EditableTable
            identifierType={identifierType}
            rows={tableRows}
            onChange={(rows) => { setTableRows(rows); setResult(null); }}
          />
        </section>

        {/* Results */}
        {result && <ResultsPanel result={result} />}
      </main>
    </div>
  );
};

export default Index;
