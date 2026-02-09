import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IdentifierType } from '@/lib/types';

export interface TableRow {
  id: string;
  identifier: string;
  newEK: string;
  newVK: string;
}

type ColKey = 'identifier' | 'newEK' | 'newVK';
const COLUMNS: { key: ColKey; label: (t: IdentifierType) => string; align: string }[] = [
  { key: 'identifier', label: (t) => t === 'HAN' ? 'HAN' : 'EAN Barcode', align: 'text-left' },
  { key: 'newEK', label: () => 'Neuer EK', align: 'text-right' },
  { key: 'newVK', label: () => 'Neuer VK', align: 'text-right' },
];

let rowIdCounter = 0;
function newRow(): TableRow {
  return { id: `r-${++rowIdCounter}`, identifier: '', newEK: '', newVK: '' };
}

function createRows(count: number): TableRow[] {
  return Array.from({ length: count }, () => newRow());
}

interface EditableTableProps {
  identifierType: IdentifierType;
  rows: TableRow[];
  onChange: (rows: TableRow[]) => void;
}

export function EditableTable({ identifierType, rows, onChange }: EditableTableProps) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const colKeys: ColKey[] = COLUMNS.map(c => c.key);

  const updateCell = useCallback((rowIdx: number, col: ColKey, value: string) => {
    const next = [...rows];
    next[rowIdx] = { ...next[rowIdx], [col]: value };
    onChange(next);
  }, [rows, onChange]);

  const addRow = useCallback(() => {
    onChange([...rows, newRow()]);
  }, [rows, onChange]);

  const addMultipleRows = useCallback((count: number) => {
    onChange([...rows, ...createRows(count)]);
  }, [rows, onChange]);

  const deleteRow = useCallback((idx: number) => {
    if (rows.length <= 1) {
      onChange([newRow()]);
      return;
    }
    const next = rows.filter((_, i) => i !== idx);
    onChange(next);
    setActiveCell(null);
    setEditingCell(null);
  }, [rows, onChange]);

  const deleteSelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return;
    const next = rows.filter((_, i) => !selectedRows.has(i));
    onChange(next.length > 0 ? next : [newRow()]);
    setSelectedRows(new Set());
    setActiveCell(null);
    setEditingCell(null);
  }, [rows, selectedRows, onChange]);

  const clearAll = useCallback(() => {
    onChange(createRows(5));
    setActiveCell(null);
    setEditingCell(null);
    setSelectedRows(new Set());
  }, [onChange]);

  const startEditing = useCallback((row: number, col: number) => {
    setActiveCell({ row, col });
    setEditingCell({ row, col });
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (e.shiftKey && activeCell) {
      // Shift-click range select rows
      const start = Math.min(activeCell.row, row);
      const end = Math.max(activeCell.row, row);
      const newSel = new Set<number>();
      for (let i = start; i <= end; i++) newSel.add(i);
      setSelectedRows(newSel);
    } else {
      setSelectedRows(new Set());
      startEditing(row, col);
    }
  }, [activeCell, startEditing]);

  const navigate = useCallback((rowDelta: number, colDelta: number) => {
    if (!activeCell) return;
    const newRow = Math.max(0, Math.min(rows.length - 1, activeCell.row + rowDelta));
    const newCol = Math.max(0, Math.min(colKeys.length - 1, activeCell.col + colDelta));
    setActiveCell({ row: newRow, col: newCol });
    setEditingCell(null);
  }, [activeCell, rows.length, colKeys.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!activeCell) return;

    // If editing, only handle special keys
    if (editingCell) {
      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          stopEditing();
          const nextCol = activeCell.col + (e.shiftKey ? -1 : 1);
          if (nextCol >= colKeys.length) {
            // Move to next row
            if (activeCell.row < rows.length - 1) {
              setActiveCell({ row: activeCell.row + 1, col: 0 });
            } else {
              addRow();
              setTimeout(() => setActiveCell({ row: activeCell.row + 1, col: 0 }), 0);
            }
          } else if (nextCol < 0) {
            if (activeCell.row > 0) {
              setActiveCell({ row: activeCell.row - 1, col: colKeys.length - 1 });
            }
          } else {
            setActiveCell({ row: activeCell.row, col: nextCol });
          }
          break;
        }
        case 'Enter':
          e.preventDefault();
          stopEditing();
          if (activeCell.row < rows.length - 1) {
            setActiveCell({ row: activeCell.row + 1, col: activeCell.col });
          } else {
            addRow();
            setTimeout(() => setActiveCell({ row: activeCell.row + 1, col: activeCell.col }), 0);
          }
          break;
        case 'Escape':
          e.preventDefault();
          stopEditing();
          break;
      }
      return;
    }

    // Not editing — navigation mode
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        navigate(-1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigate(1, 0);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigate(0, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigate(0, 1);
        break;
      case 'Tab':
        e.preventDefault();
        navigate(0, e.shiftKey ? -1 : 1);
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        setEditingCell(activeCell);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selectedRows.size > 0) {
          deleteSelectedRows();
        } else {
          updateCell(activeCell.row, colKeys[activeCell.col], '');
        }
        break;
      default:
        // Start typing to edit
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          updateCell(activeCell.row, colKeys[activeCell.col], e.key);
          setEditingCell(activeCell);
        }
        break;
    }
  }, [activeCell, editingCell, navigate, stopEditing, updateCell, colKeys, rows.length, addRow, selectedRows, deleteSelectedRows]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const pasteRows = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (pasteRows.length === 0) return;

    const startRow = activeCell?.row ?? rows.length;
    const startCol = activeCell?.col ?? 0;

    const next = [...rows];

    // Ensure enough rows
    while (next.length < startRow + pasteRows.length) {
      next.push(newRow());
    }

    for (let ri = 0; ri < pasteRows.length; ri++) {
      const cells = pasteRows[ri].split('\t');
      for (let ci = 0; ci < cells.length; ci++) {
        const colIdx = startCol + ci;
        if (colIdx < colKeys.length) {
          const rowIdx = startRow + ri;
          next[rowIdx] = { ...next[rowIdx], [colKeys[colIdx]]: cells[ci].trim() };
        }
      }
    }

    onChange(next);
    setEditingCell(null);
  }, [activeCell, rows, colKeys, onChange]);

  const handleCopy = useCallback((e: ClipboardEvent) => {
    if (!activeCell) return;
    e.preventDefault();

    if (selectedRows.size > 0) {
      const lines = Array.from(selectedRows).sort().map(ri => {
        return colKeys.map(ck => rows[ri][ck]).join('\t');
      });
      e.clipboardData.setData('text/plain', lines.join('\n'));
    } else {
      const val = rows[activeCell.row][colKeys[activeCell.col]];
      e.clipboardData.setData('text/plain', val);
    }
  }, [activeCell, selectedRows, rows, colKeys]);

  const filledRows = rows.filter(r => r.identifier.trim() !== '').length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Zeile
          </Button>
          <Button variant="outline" size="sm" onClick={() => addMultipleRows(10)} className="text-xs">
            +10 Zeilen
          </Button>
          {selectedRows.size > 0 && (
            <Button variant="outline" size="sm" onClick={deleteSelectedRows} className="gap-1.5 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> {selectedRows.size} löschen
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">{filledRows} Einträge</span>
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5 text-xs text-muted-foreground hover:text-destructive">
            <XCircle className="h-3.5 w-3.5" /> Alles leeren
          </Button>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="rounded-lg border bg-card overflow-hidden focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCopy={handleCopy}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-8 px-2 py-2 text-center text-xs font-medium text-muted-foreground">#</th>
              {COLUMNS.map(col => (
                <th key={col.key} className={`px-3 py-2 text-xs font-medium text-muted-foreground ${col.align}`}>
                  {col.label(identifierType)}
                </th>
              ))}
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isSelected = selectedRows.has(ri);
              return (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 group ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                >
                  <td
                    className="px-2 py-0 text-center text-xs text-muted-foreground font-mono cursor-pointer select-none"
                    onClick={() => {
                      const next = new Set(selectedRows);
                      if (next.has(ri)) next.delete(ri);
                      else next.add(ri);
                      setSelectedRows(next);
                    }}
                  >
                    {ri + 1}
                  </td>
                  {COLUMNS.map((col, ci) => {
                    const isActive = activeCell?.row === ri && activeCell?.col === ci;
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;

                    return (
                      <td
                        key={col.key}
                        className={`px-0 py-0 relative cursor-cell ${col.align} ${
                          isActive ? 'outline outline-2 outline-primary outline-offset-[-2px] z-10' : ''
                        }`}
                        onClick={(e) => handleCellClick(ri, ci, e)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className={`w-full h-full px-3 py-1.5 bg-card text-sm outline-none font-mono ${col.align}`}
                            value={row[col.key]}
                            onChange={(e) => updateCell(ri, col.key, e.target.value)}
                            onBlur={stopEditing}
                          />
                        ) : (
                          <div className={`px-3 py-1.5 min-h-[32px] font-mono text-sm truncate ${
                            row[col.key] ? 'text-foreground' : 'text-muted-foreground/30'
                          }`}>
                            {row[col.key] || (ci === 0 ? '—' : '0,00')}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-0">
                    <button
                      className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteRow(ri)}
                      tabIndex={-1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Tipp: Daten aus Excel/Google Sheets direkt einfügen (Strg+V). Tab zum Navigieren, Enter für nächste Zeile.
      </p>
    </div>
  );
}
