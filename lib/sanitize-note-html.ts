import sanitizeHtml from "sanitize-html";

/* General Notes and Private Notes store their body as sanitized HTML
   (not plain text) so a note can carry bold/italic/underline, a font
   family/size/color, bullet/checklist/hyphen lists -- see
   components/sticky-note-composer.tsx, the editor that produces this
   HTML in the first place. Run ONCE here, server-side, at save time
   (addGeneralNote/addPrivateNote in their respective actions.ts) --
   every later render trusts the already-cleaned column instead of
   re-sanitizing (or worse, trusting) raw HTML on every page view.

   sanitize-html, not isomorphic-dompurify -- that first choice broke
   both notes pages in production entirely (a hard server error on
   every visit, not just on save) even though it worked fine in local
   dev. isomorphic-dompurify pulls in jsdom to fake a DOM in Node,
   which is exactly the kind of dependency that can fail to run in a
   serverless environment (bundling, cold-start init, or a missing
   native piece jsdom expects) in ways that never show up locally.
   sanitize-html does the same allowlist job with plain string
   parsing -- no DOM, real or fake, required at all.

   The allowlist is deliberately narrow: only the tags/attributes the
   composer itself ever produces. <font> is the one surprise here --
   document.execCommand("foreColor"/"fontName"/"fontSize") in Chrome
   doesn't wrap a selection in a styled <span> the way you'd expect;
   it uses the legacy <font color=.. face=.. size=..> tag instead.

   table/thead/tbody/tr/td/th aren't produced by any toolbar button --
   they come from pasting a copied range straight from Excel/Google
   Sheets/etc into the contentEditable, which the browser turns into a
   real HTML table (complete with each cell's own background-color,
   for things like conditional-formatting highlights) by default, no
   code of ours involved. Allowed through here so that survives the
   save instead of getting stripped back down to plain paragraphs --
   background-color joins the style allowlist for the same reason
   (cell highlight colors), scoped to "*" like the others since a
   pasted table can put it on the <table>, a <tr>, or an individual
   <td>/<th> depending on the source.

   <a> is the same story again -- pasting a copied hyperlink (from a
   webpage, an email, a Sheets cell with =HYPERLINK(), etc) brings its
   own <a href> along for free; without allowing it here it degraded
   to plain unlinked text on save. allowedSchemes below restricts href
   to http/https/mailto so a pasted javascript: URL can't sneak an
   attribute-based XSS through; transformTags then forces every link
   to open in a new tab with rel="noopener noreferrer" regardless of
   what the source pasted, same safe-external-link convention this
   app already uses everywhere else.

   <img> covers pasting a screenshot/copied image directly into the
   composer -- Chrome inserts it as <img src="data:image/png;base64,..."
   on paste, no code of ours involved, same as the table/link cases
   above. data: is only allowed as a scheme for THIS tag (via
   allowedSchemesByTag, which overrides the global allowedSchemes list
   above just for img) -- an <a href="data:..."> is still blocked, so
   this can't be used to smuggle a clickable data: link past the
   href-scheme restriction. */
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "font", "div", "br", "ul", "ol", "li", "input", "table", "thead", "tbody", "tr", "td", "th", "a", "img"];
const ALLOWED_ATTR = ["style", "class", "color", "face", "size", "type", "checked", "disabled", "colspan", "rowspan", "href", "target", "rel", "src", "alt", "width", "height"];
const ALLOWED_STYLES = {
  "*": {
    color: [/^.*$/],
    "background-color": [/^.*$/],
    "font-family": [/^.*$/],
    "font-size": [/^.*$/],
    "font-weight": [/^.*$/],
    "text-align": [/^.*$/],
    "vertical-align": [/^.*$/],
    border: [/^.*$/],
    "border-color": [/^.*$/],
    width: [/^.*$/],
    height: [/^.*$/],
  },
};

/* A pasted spreadsheet range brings its own fixed sizing on every table
   element: width/height attributes, and inline width/height/font-size.
   Dropped here so the saved note carries none of it (the display CSS in
   app/globals.css, .note-html, handles notes saved before this). Colors,
   borders, alignment and everything else are kept. */
const SIZING_STYLE = /^s*(width|min-width|max-width|height|min-height|max-height|font-size)s*:/i;

function stripTableSizing(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const next = { ...attribs };
  delete next.width;
  delete next.height;
  if (next.style) {
    const kept = next.style.split(";").filter((declaration) => declaration.trim() && !SIZING_STYLE.test(declaration));
    if (kept.length > 0) next.style = kept.join(";");
    else delete next.style;
  }
  return { tagName, attribs: next };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

// Matches a bare URL (http(s):// or a bare "www.") in otherwise plain
// text -- not every link a VA saves comes in as a rich pasted anchor
// (the case sanitize-html's own tag/attribute allowlist handles
// above); typing or pasting a plain address needs the same "click to
// open" treatment. Trailing punctuation (a period ending the
// sentence, a comma, a closing bracket) is peeled off the match and
// left as plain text after the link, so "see angeloelementary.edu."
// doesn't glue the period into the URL.
const BARE_URL = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;
// Combined with BARE_URL below (not run as a separate second pass over
// the URL-linkified output) so URL and @mention matches are found in
// one single left-to-right sweep of the ORIGINAL plain text -- running
// this as a second pass over already-tagged HTML would risk matching
// inside a freshly-inserted <a href="..."> attribute instead of the
// original text. Only one of the two capture groups is ever set per
// match: group 1 for a URL, group 2 for an @word.
const LINKIFY_PATTERN = new RegExp(`${BARE_URL.source}|@(\\w+)`, "gi");

function linkifyPlainText(text: string, mentionColorByLowerName: Map<string, { name: string; color: string }>): string {
  let lastIndex = 0;
  let out = "";
  for (const match of text.matchAll(LINKIFY_PATTERN)) {
    const start = match.index!;
    out += escapeHtml(text.slice(lastIndex, start));
    if (match[1]) {
      const raw = match[1];
      const trailingMatch = raw.match(TRAILING_PUNCTUATION);
      const trailing = trailingMatch ? trailingMatch[0] : "";
      const url = trailing ? raw.slice(0, -trailing.length) : raw;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      out += `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    } else if (match[2]) {
      const mentioned = mentionColorByLowerName.get(match[2].toLowerCase());
      out += mentioned ? `<b style="color:${escapeAttr(mentioned.color)}">@${escapeHtml(mentioned.name)}</b>` : escapeHtml(match[0]);
    }
    lastIndex = start + match[0].length;
  }
  out += escapeHtml(text.slice(lastIndex));
  return out;
}

export function sanitizeNoteHtml(html: string, teamRoster: { name: string; color?: string }[] = []): string {
  const mentionColorByLowerName = new Map(
    teamRoster.map((v) => [v.name.toLowerCase(), { name: v.name, color: v.color || "var(--muted-foreground)" }])
  );
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data", "http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
      table: stripTableSizing,
      thead: stripTableSizing,
      tbody: stripTableSizing,
      tr: stripTableSizing,
      td: stripTableSizing,
      th: stripTableSizing,
    },
    // input[type=checkbox] and img are the void/self-closing tags this
    // composer (or a browser's own paste handling) ever inserts.
    selfClosing: ["br", "input", "img"],
    // Runs on every remaining text node during output -- the ONE hook
    // sanitize-html gives you to inject markup (its return value is
    // spliced straight into the output HTML, not re-parsed through
    // allowedTags/transformTags), which is exactly what auto-linkifying
    // needs. Skipped for text that's already the label of a real <a>
    // (tagName === "a") -- linkifying THAT would nest an <a> inside an
    // <a>, which is invalid HTML and would render wrong. Every other
    // branch must escape its own output by hand since nothing else
    // will: this callback fully replaces the library's default escaping
    // for whichever text node it's called on.
    textFilter: (text, tagName) => (tagName === "a" ? escapeHtml(text) : linkifyPlainText(text, mentionColorByLowerName)),
  });
}
