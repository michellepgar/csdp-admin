import DOMPurify from "isomorphic-dompurify";

/* General Notes and Private Notes store their body as sanitized HTML
   (not plain text) so a note can carry bold/italic/underline, a font
   family/size/color, bullet/checklist/hyphen lists -- see
   components/sticky-note-composer.tsx, the editor that produces this
   HTML in the first place. Run ONCE here, server-side, at save time
   (addGeneralNote/addPrivateNote in their respective actions.ts) --
   every later render trusts the already-cleaned column instead of
   re-sanitizing (or worse, trusting) raw HTML on every page view.

   The allowlist is deliberately narrow: only the tags/attributes the
   composer itself ever produces. <font> is the one surprise here --
   document.execCommand("foreColor"/"fontName"/"fontSize") in Chrome
   doesn't wrap a selection in a styled <span> the way you'd expect;
   it uses the legacy <font color=.. face=.. size=..> tag instead.
   Confirmed directly: color/font/size all silently vanished on save
   because <font> wasn't on this list at all, so DOMPurify stripped
   the tag (and every attribute on it) outright, keeping only the
   plain text inside. style itself is restricted to the three
   properties the composer's fallback (non-Chrome) path might set,
   via ALLOWED_ATTR + a regex hook below, since DOMPurify's own
   ALLOWED_STYLES option isn't part of its stable API. */
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "font", "div", "br", "ul", "ol", "li", "input"];
// class is only ever "note-checklist-item" in practice (the one class
// the composer's own checklist rows carry, styled in globals.css) --
// still allowlisted generically rather than value-checked, same trust
// level as every other attribute here.
const ALLOWED_ATTR = ["style", "class", "color", "face", "size", "type", "checked", "disabled"];
const ALLOWED_STYLE_PROPS = /^(color|font-family|font-size)\s*:\s*[^;]+;?$/i;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "style") return;
  data.attrValue = data.attrValue
    .split(";")
    .map((rule) => rule.trim())
    .filter((rule) => rule && ALLOWED_STYLE_PROPS.test(rule + ";"))
    .join("; ");
});

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
