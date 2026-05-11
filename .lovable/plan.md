# Fix "Spalten zuordnen" Modal Overflow

## Problem
In the column-mapping dialog, the three select fields (Identifier, Neuer EK, Neuer VK) overflow horizontally — "Neuer EK" gets clipped. Cause: long CSV header names inside `SelectTrigger` push the grid cells wider than the modal because the cells lack `min-width: 0`.

## Fix
**`src/components/ColumnMapper.tsx`**
- Add `min-w-0` to each grid cell `<div>` so flex/grid children can shrink.
- Add `min-w-0` and `truncate` styling on `SelectTrigger` / `SelectValue` so long header names truncate with ellipsis instead of expanding the column.
- Keep `sm:grid-cols-3` so all three fields stay visible side-by-side at the current modal width; on very small screens they stack to single column (already the default).

**`src/pages/Index.tsx`** (DialogContent)
- Add `overflow-hidden` to the dialog content wrapper as a safeguard so no child can force horizontal scroll on the modal itself (PreviewTable already handles its own scroll).

## Files
- `src/components/ColumnMapper.tsx`
- `src/pages/Index.tsx`