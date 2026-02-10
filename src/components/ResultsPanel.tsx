import type { ComparisonResult } from '@/lib/comparison';
import { exportPriceChanges, exportStockNG, exportStockKG } from '@/lib/exportCsv';
import { Download, ArrowUpDown, Package, Warehouse, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultsPanelProps {
  result: ComparisonResult;
}

function fmt(n: number | null): string {
  if (n === null) return '–';
  return n.toFixed(2);
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const { priceChanges, stockNG, stockKG, matchedCount, skippedCount, unmatchedCount, invalidRowCount, missingJtlEkCount, missingJtlVkCount, warnings } = result;

  const identifierLabel = priceChanges.length > 0 ? (priceChanges[0].identifierType === 'EAN' ? 'EAN' : 'HAN') : 'Identifier';

  const stats = [
    { label: 'Zugeordnet', value: matchedCount, color: 'text-primary' },
    { label: 'Unverändert', value: skippedCount, color: 'text-muted-foreground' },
    { label: 'Geändert', value: priceChanges.length, color: 'text-success' },
    { label: 'Nicht gefunden', value: unmatchedCount, color: 'text-destructive' },
    ...(invalidRowCount > 0 ? [{ label: 'Ungültige Zeilen', value: invalidRowCount, color: 'text-warning' }] : []),
    ...(missingJtlEkCount > 0 ? [{ label: 'JTL ohne EK', value: missingJtlEkCount, color: 'text-warning' }] : []),
    ...(missingJtlVkCount > 0 ? [{ label: 'JTL ohne VK', value: missingJtlVkCount, color: 'text-warning' }] : []),
  ];

  const exports = [
    { label: 'Preisänderungen', icon: ArrowUpDown, count: priceChanges.length, onClick: () => exportPriceChanges(priceChanges), disabled: priceChanges.length === 0 },
    { label: 'Bestand NG', icon: Package, count: stockNG.length, onClick: () => exportStockNG(stockNG), disabled: stockNG.length === 0 },
    { label: 'Bestand KG', icon: Warehouse, count: stockKG.length, onClick: () => exportStockKG(stockKG), disabled: stockKG.length === 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Export buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        {exports.map(exp => (
          <Button key={exp.label} variant="outline" className="h-auto flex-col gap-2 p-4 hover:border-primary hover:bg-primary/5" disabled={exp.disabled} onClick={exp.onClick}>
            <div className="flex items-center gap-2">
              <exp.icon className="h-4 w-4" />
              <Download className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">{exp.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{exp.count} Zeilen</span>
          </Button>
        ))}
      </div>

      {/* Comparison result table — fixed 7-column schema, all rows, no limits */}
      {priceChanges.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <p className="text-sm font-semibold">Preisänderungen ({priceChanges.length} Zeilen)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{identifierLabel}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">OLD EK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">NEW EK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">EK Diff.</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">OLD VK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">NEW VK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">VK Diff.</th>
                </tr>
              </thead>
              <tbody>
                {priceChanges.map((r, i) => {
                  const ekDiff = r.oldEK !== null && r.newEK !== null ? r.newEK - r.oldEK : null;
                  const vkDiff = r.oldVK !== null && r.newVK !== null ? r.newVK - r.oldVK : null;
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{r.identifierValue}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.oldEK)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.newEK)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${ekDiff !== null && ekDiff > 0 ? 'text-destructive' : ekDiff !== null && ekDiff < 0 ? 'text-success' : ''}`}>
                        {ekDiff !== null ? `${ekDiff > 0 ? '+' : ''}${ekDiff.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.oldVK)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.newVK)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${vkDiff !== null && vkDiff > 0 ? 'text-destructive' : vkDiff !== null && vkDiff < 0 ? 'text-success' : ''}`}>
                        {vkDiff !== null ? `${vkDiff > 0 ? '+' : ''}${vkDiff.toFixed(2)}` : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
