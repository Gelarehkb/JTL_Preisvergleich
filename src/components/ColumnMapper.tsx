import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnMapperProps {
  headers: string[];
  skuColumn: string;
  ekColumn: string;
  vkColumn: string;
  onSkuChange: (v: string) => void;
  onEkChange: (v: string) => void;
  onVkChange: (v: string) => void;
}

export function ColumnMapper({ headers, skuColumn, ekColumn, vkColumn, onSkuChange, onEkChange, onVkChange }: ColumnMapperProps) {
  const fields = [
    { label: 'SKU / Identifier', value: skuColumn, onChange: onSkuChange },
    { label: 'Neuer EK', value: ekColumn, onChange: onEkChange },
    { label: 'Neuer VK', value: vkColumn, onChange: onVkChange },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Spaltenzuordnung</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map(f => (
          <div key={f.label}>
            <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Spalte wählen" />
              </SelectTrigger>
              <SelectContent>
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
