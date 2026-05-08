import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnMapperProps {
  headers: string[];
  skuColumn: string;
  ekColumn: string;
  vkColumn: string;
  onSkuChange: (v: string) => void;
  onEkChange: (v: string) => void;
  onVkChange: (v: string) => void;
  identifierLabel?: string;
}

export const NONE_VALUE = '__none__';

export function ColumnMapper({
  headers,
  skuColumn,
  ekColumn,
  vkColumn,
  onSkuChange,
  onEkChange,
  onVkChange,
  identifierLabel = 'HAN / EAN',
}: ColumnMapperProps) {
  const fields = [
    { label: identifierLabel, value: skuColumn, onChange: onSkuChange, allowNone: false },
    { label: 'Neuer EK', value: ekColumn, onChange: onEkChange, allowNone: true },
    { label: 'Neuer VK', value: vkColumn, onChange: onVkChange, allowNone: true },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Spaltenzuordnung</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map(f => (
          <div key={f.label}>
            <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
            <Select value={f.value || (f.allowNone ? NONE_VALUE : '')} onValueChange={(v) => f.onChange(v === NONE_VALUE ? '' : v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Spalte wählen" />
              </SelectTrigger>
              <SelectContent>
                {f.allowNone && <SelectItem value={NONE_VALUE} className="text-xs italic">— keine —</SelectItem>}
                {headers.map(h => (
                  <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
