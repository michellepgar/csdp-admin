// Every VA name in this app is a single word (a first name) -- see
// this feature's design doc's "Scope" section for why single-word
// matching is a deliberate v1 choice, not an oversight. Known
// limitation, accepted for v1: this can also match inside something
// that merely LOOKS like a mention (e.g. the "example" in an email
// address "user@example.com") if a teammate happens to share that
// exact word as their name -- extremely unlikely given this app's
// actual roster, and not worth the extra complexity of excluding it.
const MENTION_PATTERN = /@(\w+)/g;

/* Pulls every @word token out of `text` and keeps only the ones that
   match a real teammate's name in `teamNames`, case-insensitively --
   returned in that teammate's ACTUAL stored casing (so "@faith"
   records against "Faith", not "faith"), de-duplicated, in
   first-occurrence order. Does NOT exclude the poster mentioning
   themselves -- only a caller knows who the poster is, so callers
   filter that out themselves before recording a mention. */
export function extractMentionedNames(text: string, teamNames: string[]): string[] {
  const byLowerName = new Map(teamNames.map((n) => [n.toLowerCase(), n]));
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const real = byLowerName.get(match[1].toLowerCase());
    if (real && !seen.has(real)) {
      seen.add(real);
      found.push(real);
    }
  }
  return found;
}

/* A plain-text preview for the mentions bell dropdown -- General
   Notes store sanitized HTML (lib/sanitize-note-html.ts), which isn't
   fit to store or display as a one-line snippet as-is. Issue Comments
   are already plain text, so this is a no-op pass-through for them
   (no tags to strip) other than the length cap. */
export function snippetFromHtml(html: string, maxLength = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    // A stripped closing tag right before punctuation (e.g. "<b>@Faith</b>,")
    // otherwise leaves a stray space: "@Faith ,". Not needed before the
    // whitespace collapse above, since a real double-space never
    // survives it -- this only ever removes a SINGLE space.
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}
