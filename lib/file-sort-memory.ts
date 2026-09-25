/* Browser-only memory of each Tasks table's file-name sort (A–Z / Z–A), per
   school, so it's still there after a refresh. A convenience, not data: every
   read and write tolerates storage being unavailable. */

export type FileSortDirection = "asc" | "desc";
type SchoolSorts = Record<string, FileSortDirection>;

const KEY = "csdp-file-sort";

function readAll(): Record<string, SchoolSorts> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadFileSorts(schoolId: string): SchoolSorts {
  const saved = readAll()[schoolId];
  if (!saved || typeof saved !== "object") return {};
  const result: SchoolSorts = {};
  for (const [table, direction] of Object.entries(saved)) if (direction === "asc" || direction === "desc") result[table] = direction;
  return result;
}

export function saveFileSorts(schoolId: string, sorts: SchoolSorts) {
  try {
    const all = readAll();
    if (Object.keys(sorts).length === 0) delete all[schoolId];
    else all[schoolId] = sorts;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the sort just resets on refresh.
  }
}
