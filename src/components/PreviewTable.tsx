import { useEffect, useRef, useState } from 'react';

interface PreviewTableProps {
  headers: string[];
  rows: Record<string, string>[];
  defaultColumnWidth?: number;
  minColumnWidth?: number;
  maxHeight?: number;
}

/**
 * Excel-like preview table:
 * - Fixed equal column widths by default
 * - Resizable column dividers (drag the right edge of any header cell)
 * - Horizontal & vertical scroll inside a bounded container
 */
export function PreviewTable({
  headers,
  rows,
  defaultColumnWidth = 160,
  minColumnWidth = 60,
  maxHeight = 360,
}: PreviewTableProps) {
  const [widths, setWidths] = useState<number[]>(() => headers.map(() => defaultColumnWidth));
  const dragRef = useRef<{ index: number; startX: number; startW: number } | null>(null);

  // Reset widths when columns change
  useEffect(() => {
    setWidths(headers.map(() => defaultColumnWidth));
  }, [headers, defaultColumnWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const w = Math.max(minColumnWidth, d.startW + (e.clientX - d.startX));
      setWidths(prev => {
        const next = [...prev];
        next[d.index] = w;
        return next;
      });
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minColumnWidth]);

  const startDrag = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { index, startX: e.clientX, startW: widths[index] ?? defaultColumnWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (!headers.length) return null;

  const equalPct = `${100 / headers.length}%`;

  return (
    <div
      className="overflow-y-auto overflow-x-hidden rounded-md border bg-card"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {headers.map((h, i) => (
            <col key={h + i} style={{ width: equalPct }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h + i}
                className="relative truncate border-b border-r px-2 py-1.5 text-left font-medium text-foreground"
                title={h}
              >
                <span className="block truncate">{h || <span className="text-muted-foreground italic">(leer)</span>}</span>
                <span
                  onMouseDown={startDrag(i)}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/40"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="even:bg-muted/30">
              {headers.map((h, ci) => (
                <td
                  key={h + ci}
                  className="truncate border-b border-r px-2 py-1 text-foreground"
                  title={row[h]}
                >
                  {row[h]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-2 py-4 text-center text-muted-foreground">
                Keine Datenzeilen.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
