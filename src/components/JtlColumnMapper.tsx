import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface JtlColumnMapperProps {
  headers: string[];
  eanColumn: string;
  hanColumn: string;
  ekColumn: string;
  vkColumn: string;
  onEanChange: (v: string) => void;
  onHanChange: (v: string) => void;
  onEkChange: (v: string) => void;
  onVkChange: (v: string) => void;
}

export const NONE_VALUE = '__none__';

export function JtlColumnMapper({
  headers,
  eanColumn,
  hanColumn,
  ekColumn,
  vkColumn,
  onEanChange,
  onHanChange,
  onEkChange,
  onVkChange,
}: JtlColumnMapperProps) {
  const fields = [
    { label: 'EAN', value: eanColumn, onChange: onEanChange },
    { label: 'HAN', value: hanColumn, onChange: onHanChange },
    { label: 'EK (Netto)', value: ekColumn, onChange: onEkChange },
    { label: 'VK (Brutto)', value: vkColumn, onChange: onVkChange },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Spaltenzuordnung – JTL Export</p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {fields.map(f => (
          <div key={f.label} className="min-w-0">
            <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
            <Select value={f.value || NONE_VALUE} onValueChange={(v) => f.onChange(v === NONE_VALUE ? '' : v)}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs [&>span]:truncate [&>span]:block [&>span]:min-w-0">
                <SelectValue placeholder="Spalte wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE} className="text-xs italic">— keine —</SelectItem>
                {headers.filter(h => h && h.trim() !== '').map(h => (
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
