/* Which text colors a note pad needs: dark text on a light pad, light text
   on a dark one, whatever the page theme. Returns a class from globals.css
   (or "" with no pad color, when the note just follows the theme). */
export function padTextClass(padColor: string | undefined | null): string {
  if (!padColor) return "";
  const match = /^#([0-9a-f]{6})$/i.exec(padColor.trim());
  if (!match) return "note-on-light-pad";
  const channel = (start: number) => {
    const c = parseInt(match[1].slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // 0.18 is roughly where dark and light text have equal contrast.
  return luminance > 0.18 ? "note-on-light-pad" : "note-on-dark-pad";
}
