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
  const { priceChanges, stockNG, stockKG, matchedCount, skippedCount, unmatchedCount, invalidRowCount, warnings } = result;

  const stats = [
    { label: 'Zugeordnet', value: matchedCount, color: 'text-primary' },
    { label: 'Unverändert', value: skippedCount, color: 'text-muted-foreground' },
    { label: 'Geändert', value: priceChanges.length, color: 'text-success' },
    { label: 'Nicht gefunden', value: unmatchedCount, color: 'text-destructive' },
    ...(invalidRowCount > 0 ? [{ label: 'Ungültige Zeilen', value: invalidRowCount, color: 'text-warning' }] : []),
  ];

  const exports = [
    {
      label: 'Preisänderungen',
      icon: ArrowUpDown,
      count: priceChanges.length,
      onClick: () => exportPriceChanges(priceChanges),
      disabled: priceChanges.length === 0,
    },
    {
      label: 'Bestand NG',
      icon: Package,
      count: stockNG.length,
      onClick: () => exportStockNG(stockNG),
      disabled: stockNG.length === 0,
    },
    {
      label: 'Bestand KG',
      icon: Warehouse,
      count: stockKG.length,
      onClick: () => exportStockKG(stockKG),
      disabled: stockKG.length === 0,
    },
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
          <Button
            key={exp.label}
            variant="outline"
            className="h-auto flex-col gap-2 p-4 hover:border-primary hover:bg-primary/5"
            disabled={exp.disabled}
            onClick={exp.onClick}
          >
            <div className="flex items-center gap-2">
              <exp.icon className="h-4 w-4" />
              <Download className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">{exp.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{exp.count} Zeilen</span>
          </Button>
        ))}
      </div>

      {/* Preview table */}
      {priceChanges.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <p className="text-sm font-semibold">Vorschau Preisänderungen</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Int. Schlüssel</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Identifier</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Alt EK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Neu EK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Alt VK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Neu VK</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">VK Diff.</th>
                </tr>
              </thead>
              <tbody>
                {priceChanges.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{r.internerSchluessel}</td>
                    <td className="px-3 py-2 font-mono">{r.identifierValue}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.oldEK)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.newEK)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.oldVK)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.newVK)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${r.vkDifference !== null && r.vkDifference > 0 ? 'text-destructive' : r.vkDifference !== null && r.vkDifference < 0 ? 'text-success' : ''}`}>
                      {r.vkDifference !== null ? `${r.vkDifference > 0 ? '+' : ''}${r.vkDifference.toFixed(2)}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {priceChanges.length > 20 && (
            <div className="border-t bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
              Zeige 20 von {priceChanges.length} Zeilen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
