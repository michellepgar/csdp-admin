/* Keyword search over private notes -- used by the top bar's search (via
   searchPrivateNotes in app/(app)/private-notes/actions.ts) and by the
   Private Notes page's own search box, so both match the same way. A note's
   text is saved as sanitized HTML, so it's turned back into plain text first. */

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/* The words a note has to contain: lowercase, split on spaces, blanks and
   repeats dropped. */
export function searchWords(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}

/* A note's saved HTML as one line of plain text (tags dropped, line breaks and
   list items become spaces, the common entities decoded). */
export function noteToPlainText(html: string): string {
  return html
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) && value > 0 ? String.fromCodePoint(value) : whole;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/* Every word has to appear somewhere in the note (any order, any case). */
export function noteMatches(html: string, words: string[]): boolean {
  if (words.length === 0) return true;
  const plain = noteToPlainText(html).toLowerCase();
  return words.every((word) => plain.includes(word));
}

/* A short piece of the note around the first match, so the result shows why
   it matched. */
export function noteSnippet(html: string, words: string[], length = 90): string {
  const plain = noteToPlainText(html);
  if (plain.length <= length) return plain;
  const lower = plain.toLowerCase();
  const first = words.map((word) => lower.indexOf(word)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, Math.min(first - 20, plain.length - length));
  const piece = plain.slice(start, start + length).trim();
  return `${start > 0 ? "…" : ""}${piece}${start + length < plain.length ? "…" : ""}`;
}
