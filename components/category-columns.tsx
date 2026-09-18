import Link from "next/link";
import { StatusBadge, type StatusTone } from "@/components/status-badge";

export interface CategoryColumnRow {
  key: string;
  label: string;
  sublabel?: string;
  href?: string;
  status?: string;
  statusTone?: StatusTone;
  /** An optional trailing control per row -- e.g. Plans for Tomorrow's
   *  own-item-only remove button. Omitted entirely (not just hidden)
   *  keeps read-only surfaces like Today from rendering an empty slot. */
  action?: React.ReactNode;
}

export interface CategoryColumn {
  category: string;
  rows: CategoryColumnRow[];
}

const FALLBACK_ACCENT = "#8A5CF6"; // matches --plan-accent-secondary, for a VA with no color of their own

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/* Mixes toward white (positive) or black (negative) by `percent` --
   same "tint/shade" math a color picker's lightness slider uses. */
function shade(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = percent >= 0 ? 255 : 0;
  const p = Math.min(100, Math.abs(percent)) / 100;
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
}

function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

/* One consistent color per VA across every one of their category
   headers -- a darker tone of their own assigned color, not the raw
   color itself (which is tuned to read as a name label/left border on
   a light background, not as a solid header fill) and not varied per
   category -- Michelle asked for one settled color per VA here,
   having tried shading it per category first. */
function darkenForHeader(baseColor: string): string {
  return shade(baseColor, -30);
}

/* One column per category, file rows underneath, status beside each
   file -- the shape tasks-card.tsx's own category tables already use,
   reused here for Overview's Today and Plans for Tomorrow (the VAs
   asked for the same "category on top, files below, status beside"
   layout there too, instead of one flat mixed list). Deliberately NOT
   a real <table>: unlike tasks-card.tsx's file-x-category grid, a
   VA's items don't share row alignment across categories -- one
   category might have three files, another just one -- so each
   column is its own independent list rather than aligned table rows. */
export function CategoryColumns({ columns, accentColor }: { columns: CategoryColumn[]; accentColor?: string }) {
  if (columns.length === 0) return null;
  const headerColor = darkenForHeader(accentColor || FALLBACK_ACCENT);
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 pb-1">
        {columns.map((col) => (
          <div key={col.category} className="w-48 shrink-0 rounded-md border">
            <div
              className="truncate px-2 py-1 text-center text-xs font-bold"
              style={{ backgroundColor: headerColor, color: readableTextColor(headerColor) }}
              title={col.category}
            >
              {col.category}
            </div>
            <ul className="divide-y">
              {col.rows.map((row) => (
                <li key={row.key} className="space-y-1 px-2 py-1.5 text-sm">
                  <div className="flex items-start justify-between gap-1">
                    {row.href ? (
                      <Link href={row.href} className="min-w-0 flex-1 font-medium break-words hover:underline">{row.label}</Link>
                    ) : (
                      <span className="min-w-0 flex-1 font-medium break-words">{row.label}</span>
                    )}
                    {row.action}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {row.sublabel ? <span className="min-w-0 truncate text-xs text-muted-foreground">{row.sublabel}</span> : <span />}
                    {row.status && <StatusBadge tone={row.statusTone ?? "neutral"}>{row.status}</StatusBadge>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
