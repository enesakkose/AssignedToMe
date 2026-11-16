/** The `@`-token being typed at the caret, if any: the `@` starts a word, and the query is what follows up to the caret. */
export function mentionAt(text: string, caret: number): { query: string; start: number } | null {
  const m = text.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { query: m[1]!, start: caret - m[1]!.length - 1 };
}

/** Folders (trailing `/`) derived from file paths, then the files — so the picker can reference a whole directory too. */
export function withFolders(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`);
  }
  return [...[...dirs].sort(), ...files];
}

/** Entries matching the query (case-insensitive substring), ranked: path-prefix, then basename-prefix, then shorter. */
export function filterPaths(entries: string[], query: string, limit = 30): string[] {
  const q = query.toLowerCase();
  if (!q) return entries.slice(0, limit);
  const base = (p: string) => p.replace(/\/$/, '').slice(p.replace(/\/$/, '').lastIndexOf('/') + 1).toLowerCase();
  const score = (p: string) => (p.toLowerCase().startsWith(q) ? 2 : base(p).startsWith(q) ? 1 : 0);
  return entries
    .filter((p) => p.toLowerCase().includes(q))
    .sort((a, b) => score(b) - score(a) || a.length - b.length)
    .slice(0, limit);
}
