/* Browser-only memory of where each workbook was left: its open sheet and how
   far each sheet's canvas was scrolled. Kept in this browser's localStorage
   (a convenience, not data), so every read and write tolerates storage being
   unavailable. Only the most recently used workbooks are kept. */

const KEY = "csdp-workspace-places";
const MAX_WORKBOOKS = 50;

type Place = { sheet?: string; scroll?: Record<string, [number, number]>; at: number };
type Places = Record<string, Place>;

function readAll(): Places {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Places) : {};
  } catch {
    return {};
  }
}

function update(workbookId: string, change: (place: Place) => void) {
  try {
    const places = readAll();
    const place: Place = places[workbookId] ?? { at: 0 };
    change(place);
    place.at = Date.now();
    places[workbookId] = place;
    const ids = Object.keys(places).sort((a, b) => (places[b].at ?? 0) - (places[a].at ?? 0));
    for (const id of ids.slice(MAX_WORKBOOKS)) delete places[id];
    localStorage.setItem(KEY, JSON.stringify(places));
  } catch {
    // Storage full or blocked: the workbook just opens on its first sheet next time.
  }
}

export function lastSheet(workbookId: string): string | null {
  const sheet = readAll()[workbookId]?.sheet;
  return typeof sheet === "string" ? sheet : null;
}

/** Every workbook's last sheet, for building links that reopen it. */
export function lastSheets(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [id, place] of Object.entries(readAll())) if (typeof place?.sheet === "string") result[id] = place.sheet;
  return result;
}

export function rememberSheet(workbookId: string, sheetId: string) {
  update(workbookId, (place) => {
    place.sheet = sheetId;
  });
}

export function lastScroll(workbookId: string, sheetId: string): [number, number] | null {
  const scroll = readAll()[workbookId]?.scroll?.[sheetId];
  return Array.isArray(scroll) && scroll.length === 2 && scroll.every((n) => Number.isFinite(n)) ? scroll : null;
}

export function rememberScroll(workbookId: string, sheetId: string, left: number, top: number) {
  update(workbookId, (place) => {
    place.scroll = { ...(place.scroll ?? {}), [sheetId]: [Math.round(left), Math.round(top)] };
  });
}
