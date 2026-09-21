/* Small pure helpers behind the header's Quick add (components/quick-add-dialog.tsx). */

/* One file name per line: trimmed, blanks dropped, and the same name typed
   twice (ignoring capitals) kept once, in the order typed. */
export function parseFileNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

/* A category belongs to one table per school -- once it's in a table it isn't
   offered for a new one (files go into that table via "Existing table"). Any
   category already ticked stays visible, so the ticks don't vanish from under
   you when a successful add turns a category into a table. */
export function categoriesWithoutTable<T extends { id: string }>(
  categories: T[],
  tables: { categoryIds: string[] }[],
  keepIds: string[] = [],
): T[] {
  const inTable = new Set(tables.flatMap((table) => table.categoryIds));
  return categories.filter((category) => !inTable.has(category.id) || keepIds.includes(category.id));
}

/* A private note is stored as HTML, so plain typed text needs its characters
   escaped and its line breaks turned into <br> -- otherwise "a < b" would be
   read as a tag and every line would run together. */
export function plainTextToNoteHtml(text: string): string {
  return text
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}
