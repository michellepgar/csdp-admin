import type { CellFont, CellFormat, CellSize, PastedStyle } from "@/lib/workspace";

/* Browser-only. Excel and Google Sheets put two versions of a copied range
   on the clipboard: plain tab-separated text (the values) and HTML (the same
   table with its styling). The values always come from the plain text; this
   reads the HTML only for each cell's highlight color and text styling.

   Excel styles cells through a <style> block of classes, so styles can't be
   read off attributes -- the HTML is loaded into a hidden, sandboxed iframe
   (no scripts run, nothing is fetched) and each cell's computed style is
   read there. */

const LOAD_TIMEOUT_MS = 1500;

function toHex(color: string): string | null {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(color.trim());
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) < 0.5) return null; // transparent
  const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return hex === "FFFFFF" ? null : `#${hex}`; // white is "no highlight" in a spreadsheet
}

/* Plain black/near-black and white text is just the default; any other color is kept. */
function textColor(color: string): string | null {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color.trim());
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (Math.max(r, g, b) < 100 || Math.min(r, g, b) > 235) return null; // too dark to read on a dark cell, or white
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function sizeFor(px: number): CellSize | undefined {
  if (px < 12.5) return "sm";
  if (px >= 21) return "xl";
  if (px >= 16.5) return "lg";
  return undefined;
}

function fontFor(family: string): CellFont | undefined {
  const f = family.toLowerCase();
  if (/comic|cursive|handwrit|caveat|marker/.test(f)) return "hand";
  if (/mono|courier|consolas|menlo/.test(f)) return "mono";
  if (/(^|[\s,"'])serif|times|georgia|garamond|cambria|palatino|book antiqua/.test(f.replace(/sans-serif/g, ""))) return "serif";
  return undefined;
}

function styleOf(cell: HTMLTableCellElement, view: Window): PastedStyle | null {
  // The text usually sits in the cell itself, sometimes wrapped in <b>, <font> or <span>.
  let inner: Element = cell;
  while (inner.children.length === 1) inner = inner.children[0];
  const cs = view.getComputedStyle(inner);
  const format: CellFormat = {};
  if (Number(cs.fontWeight) >= 600 || cs.fontWeight === "bold") format.b = true;
  if (cs.fontStyle === "italic" || cs.fontStyle === "oblique") format.i = true;
  // text-decoration isn't inherited in computed style, so look up to the cell.
  for (let el: Element | null = inner; el; el = el === cell ? null : el.parentElement) {
    if (view.getComputedStyle(el).textDecorationLine.includes("underline")) {
      format.u = true;
      break;
    }
  }
  const size = sizeFor(parseFloat(cs.fontSize));
  if (size) format.size = size;
  const font = fontFor(cs.fontFamily);
  if (font) format.font = font;
  const align = view.getComputedStyle(cell).textAlign;
  if (align === "center") format.align = "center";
  else if (align === "right" || align === "end") format.align = "right";
  const color = textColor(cs.color);
  if (color) format.color = color;
  const fill = toHex(view.getComputedStyle(cell).backgroundColor);
  const style: PastedStyle = {};
  if (fill) style.fill = fill;
  if (Object.keys(format).length > 0) style.format = format;
  return Object.keys(style).length > 0 ? style : null;
}

/** Each cell's styling from a copied spreadsheet range, row by row; null when the HTML holds no table. */
export async function readClipboardTableStyles(html: string): Promise<(PastedStyle | null)[][] | null> {
  if (!html || !/<table/i.test(html)) return null;
  // Drop anything that could load or run before the sandbox even applies.
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script, img, link, iframe, object, embed, video, audio, source, meta[http-equiv]").forEach((el) => el.remove());
  // A blank page defaults to a serif font at 16px; start from plain text so only real styling is picked up.
  const base = parsed.createElement("style");
  base.textContent = "body, table, td, th { font-family: sans-serif; font-size: 14px; }";
  parsed.head.prepend(base);

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:10px;visibility:hidden;border:0";
  try {
    const loaded = new Promise<boolean>((resolve) => {
      frame.addEventListener("load", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    });
    frame.srcdoc = `<!doctype html>${parsed.documentElement.outerHTML}`;
    document.body.appendChild(frame);
    if (!(await loaded)) return null;
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    const table = doc?.querySelector("table");
    if (!doc || !view || !table) return null;
    const styles: (PastedStyle | null)[][] = [];
    for (const row of Array.from(table.rows)) {
      const line: (PastedStyle | null)[] = [];
      for (const cell of Array.from(row.cells)) {
        const style = styleOf(cell, view);
        line.push(style);
        for (let extra = 1; extra < Math.min(cell.colSpan || 1, 30); extra++) line.push(style);
      }
      styles.push(line);
    }
    return styles;
  } catch {
    return null;
  } finally {
    frame.remove();
  }
}
