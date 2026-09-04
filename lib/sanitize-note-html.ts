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
   it uses the legacy <font color=.. face=.. size=..> tag instead. */
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "font", "div", "br", "ul", "ol", "li", "input"];
const ALLOWED_ATTR = ["style", "class", "color", "face", "size", "type", "checked", "disabled"];
const ALLOWED_STYLES = {
  "*": {
    color: [/^.*$/],
    "font-family": [/^.*$/],
    "font-size": [/^.*$/],
  },
};

export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    allowedStyles: ALLOWED_STYLES,
    // input[type=checkbox] is the only void/self-closing tag this
    // composer ever inserts.
    selfClosing: ["br", "input"],
  });
}
