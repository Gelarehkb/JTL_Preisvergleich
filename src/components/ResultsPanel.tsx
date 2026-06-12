import { useState } from 'react';
import type { ComparisonResult } from '@/lib/comparison';
import type { LagerEntry } from '@/lib/types';
import { exportAllRows, exportChangedOnly, exportBestandNGgt0, exportBestandKGgt0, exportDCEan, exportNeuAnlegen, downloadAllExports } from '@/lib/exportCsv';
import { Download, ArrowUpDown, Package, Warehouse, List, AlertTriangle, FileX, ChevronsUpDown, FilePlus, FolderDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultsPanelProps {
  result: ComparisonResult;
  lagerMap?: Map<string, LagerEntry> | null;
}

function fmt(n: number | null): string {
  if (n === null) return '–';
  return n.toFixed(2);
}

const PREVIEW_LIMIT = 10;

export function ResultsPanel({ result, lagerMap }: ResultsPanelProps) {
  const { rows, unmatchedRows, unmatchedJTLRows, matchedCount, unmatchedCount } = result;
  const [showAll, setShowAll] = useState(false);

  const changedRows = rows.filter(r => r.changedEK || r.changedVK);
  const bestandNGgt0Count = rows.filter(r => r.changedVK && r.bestandNG > 0).length;
  const bestandKGgt0Count = rows.filter(r => r.changedVK && r.bestandKG !== null && r.bestandKG > 0).length;
  const dcEanCount = unmatchedJTLRows.length;

  const identifierLabel = rows.length > 0 ? (rows[0].identifierType === 'EAN' ? 'EAN' : 'HAN') : 'Identifier';

  const stats = [
    { label: 'Zugeordnet', value: matchedCount, color: 'text-primary' },
    { label: 'Geändert', value: changedRows.length, color: 'text-success' },
    { label: 'Unverändert', value: matchedCount - changedRows.length, color: 'text-muted-foreground' },
    { label: 'Nicht gefunden', value: unmatchedCount, color: 'text-destructive' },
  ];

  const exports = [
    { label: 'Alle Zeilen', icon: List, count: rows.length, onClick: () => exportAllRows(rows), disabled: rows.length === 0 },
    { label: 'Nur Änderungen', icon: ArrowUpDown, count: changedRows.length, onClick: () => exportChangedOnly(rows), disabled: changedRows.length === 0 },
    { label: 'Bestand NG > 0', icon: Package, count: bestandNGgt0Count, onClick: () => exportBestandNGgt0(rows, lagerMap ?? undefined), disabled: bestandNGgt0Count === 0 },
    { label: 'Bestand KG > 0', icon: Warehouse, count: bestandKGgt0Count, onClick: () => exportBestandKGgt0(rows), disabled: bestandKGgt0Count === 0 },
    { label: 'DC/EAN', icon: FileX, count: dcEanCount, onClick: () => exportDCEan(unmatchedJTLRows, rows[0]?.identifierType ?? 'EAN'), disabled: dcEanCount === 0 },
    { label: 'Neu anlegen', icon: FilePlus, count: unmatchedRows.filter(r => r.rawRow).length, onClick: () => exportNeuAnlegen(unmatchedRows), disabled: unmatchedRows.filter(r => r.rawRow).length === 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Unmatched warning */}
      {unmatchedRows.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">
            {unmatchedRows.length} Eingabe-Zeile(n) ohne Treffer im JTL Export: {unmatchedRows.slice(0, 5).map(r => r.identifier).join(', ')}
            {unmatchedRows.length > 5 ? ` …und ${unmatchedRows.length - 5} weitere` : ''}
          </p>
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
      <div className="grid gap-3 sm:grid-cols-4">
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

      {/* Download all as ZIP */}
      <div className="flex justify-end">
        <Button
          variant="default"
          className="gap-2"
          onClick={() => downloadAllExports(rows, unmatchedJTLRows, unmatchedRows, rows[0]?.identifierType ?? 'EAN', lagerMap ?? undefined)}
          disabled={rows.length === 0 && unmatchedJTLRows.length === 0 && unmatchedRows.length === 0}
        >
          <FolderDown className="h-4 w-4" />
          Alle als ZIP herunterladen
        </Button>
      </div>

      {/* Result table — preview + show all */}
      {rows.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-2.5 flex items-center justify-between">
            <p className="text-sm font-semibold">Vergleichsergebnis ({rows.length} Zeilen, {changedRows.length} geändert)</p>
            {!showAll && rows.length > PREVIEW_LIMIT && (
              <span className="text-xs text-muted-foreground">Vorschau: erste {PREVIEW_LIMIT} Zeilen</span>
            )}
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
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Bestand NG</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Bestand KG</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lieferant</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? rows : rows.slice(0, PREVIEW_LIMIT)).map((r, i) => {
                  const hasChange = r.changedEK || r.changedVK;
                  return (
                    <tr key={i} className={`border-b last:border-0 hover:bg-muted/20 ${!hasChange ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 font-mono">{r.identifier}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.oldEK)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.changedEK ? 'font-semibold' : ''}`}>{fmt(r.newEK)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${r.deltaEK !== null && r.deltaEK > 0 ? 'text-destructive' : r.deltaEK !== null && r.deltaEK < 0 ? 'text-success' : ''}`}>
                        {r.deltaEK !== null ? `${r.deltaEK > 0 ? '+' : ''}${r.deltaEK.toFixed(2)}` : '–'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(r.oldVK)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${r.changedVK ? 'font-semibold' : ''}`}>{fmt(r.newVK)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${r.deltaVK !== null && r.deltaVK > 0 ? 'text-destructive' : r.deltaVK !== null && r.deltaVK < 0 ? 'text-success' : ''}`}>
                        {r.deltaVK !== null ? `${r.deltaVK > 0 ? '+' : ''}${r.deltaVK.toFixed(2)}` : '–'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.bestandNG}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.bestandKG !== null ? r.bestandKG : '–'}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{r.lieferant || '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_LIMIT && (
            <div className="border-t px-4 py-2.5 flex justify-center">
              <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={() => setShowAll(v => !v)}>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {showAll ? `Weniger anzeigen` : `Alle ${rows.length} Zeilen anzeigen`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
