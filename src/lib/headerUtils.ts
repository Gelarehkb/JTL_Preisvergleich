const BOM = String.fromCharCode(0xfeff);

/** Normalize a header name for case/whitespace/BOM-insensitive comparison. */
export function normalizeHeader(s: string): string {
  const stripped = s.startsWith(BOM) ? s.slice(1) : s;
  return stripped.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Look up a value in a parsed row by trying a prioritized list of header name candidates. */
export function resolveColumn(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  // Fallback: case/whitespace/BOM-insensitive lookup
  const wanted = names.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (wanted.includes(normalizeHeader(key))) {
      const v = row[key];
      if (v !== undefined && v !== '') return v;
    }
  }
  return undefined;
}

/** True if any of the candidate header names appears (normalized) among the given headers. */
export function headerListHasAny(headers: string[], candidates: string[]): boolean {
  const have = headers.map(normalizeHeader);
  const wanted = candidates.map(normalizeHeader);
  return wanted.some(w => have.includes(w));
}
