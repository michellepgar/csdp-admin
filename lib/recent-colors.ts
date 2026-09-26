/* The colors you picked most recently for text or highlight in a spreadsheet,
   newest first, remembered in this browser. A convenience, not data: every
   read and write tolerates storage being unavailable. */

export type RecentColorKind = "text" | "fill";

const KEY = "csdp-recent-colors";
export const MAX_RECENT_COLORS = 8;
const HEX = /^#[0-9A-F]{6}$/;

function readAll(): Partial<Record<RecentColorKind, string[]>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function recentColors(kind: RecentColorKind): string[] {
  const list = readAll()[kind];
  return Array.isArray(list) ? list.filter((c) => typeof c === "string" && HEX.test(c)).slice(0, MAX_RECENT_COLORS) : [];
}

/** Puts a just-used color first (moving it up if it was already there). */
export function withRecentColor(list: string[], color: string): string[] {
  const hex = color.toUpperCase();
  if (!HEX.test(hex)) return list;
  return [hex, ...list.filter((c) => c !== hex)].slice(0, MAX_RECENT_COLORS);
}

export function rememberRecentColor(kind: RecentColorKind, color: string) {
  try {
    const all = readAll();
    all[kind] = withRecentColor(recentColors(kind), color);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the Recent row just stays empty.
  }
}
