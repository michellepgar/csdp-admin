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
   composer itself ever produces. style is restricted to the four
   properties the composer sets (color/font-family/font-size/font-
   weight isn't needed -- bold uses <strong>) via ALLOWED_ATTR + a
   regex hook below, since DOMPurify's own ALLOWED_STYLES option isn't
   part of its stable API. */
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "span", "div", "br", "ul", "ol", "li", "input"];
const ALLOWED_ATTR = ["style", "type", "checked", "disabled"];
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
