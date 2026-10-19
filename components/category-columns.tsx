import Link from "next/link";
import { StickyNote } from "lucide-react";
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
  /** Marks a row as a priority (the same dot Task Priorities and the
   *  Your Plan bubble already use) -- lets a priority linked to a real
   *  category still read as a priority sitting alongside ordinary
   *  tasks in that same column, not just when it's off in its own
   *  "Priorities" column. */
  dot?: boolean;
  /** The owner's own explanation for this item (a work note), shown under it. */
  note?: string;
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

/* WCAG contrast of a color against white, and that color darkened step by
   step until it reads at 4.5:1 or better there (the tile label sits on a
   white card now, not on its own colored block). */
function contrastOnWhite(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}
function inkOnWhite(hex: string): string {
  let c = hex;
  for (let i = 0; i < 12 && contrastOnWhite(c) < 4.5; i++) c = shade(c, -12);
  return c;
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
          <div key={col.category} className="w-64 shrink-0 rounded-lg border-t-[3px] bg-card shadow-sm" style={{ borderTopColor: headerColor }}>
            <div
              className="truncate px-2.5 pt-1.5 pb-1 text-xs font-bold text-(--tile-ink) dark:text-[color-mix(in_oklab,var(--tile-edge)_55%,white)]"
              style={{ "--tile-ink": inkOnWhite(headerColor), "--tile-edge": headerColor } as React.CSSProperties}
              title={col.category}
            >
              {col.category}
            </div>
            <ul className="divide-y border-t">
              {col.rows.map((row) => (
                <li key={row.key} className={`space-y-1 px-2.5 py-1.5 text-sm transition-colors last:rounded-b-lg ${row.href ? "hover:bg-primary/10" : ""}`}>
                  <div className="flex items-start justify-between gap-1">
                    {row.href ? (
                      <Link href={row.href} prefetch={false} className="flex min-w-0 flex-1 items-center font-medium break-words hover:underline">{row.dot && <span className="priority-dot" aria-hidden />}{row.label}</Link>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center font-medium break-words">{row.dot && <span className="priority-dot" aria-hidden />}{row.label}</span>
                    )}
                    {row.action}
                  </div>
                  {/* Wraps: the school name keeps its full width and a long
                      status ("Waiting on Them") drops underneath it instead
                      of squeezing into two lines or cutting the name short. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1">
                    {row.sublabel ? <span className="max-w-full min-w-0 truncate text-xs text-muted-foreground" title={row.sublabel}>{row.sublabel}</span> : <span />}
                    {row.status && <StatusBadge tone={row.statusTone ?? "neutral"}>{row.status}</StatusBadge>}
                  </div>
                  {row.note && (
                    <p className="flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1 text-xs italic text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                      <StickyNote className="mt-0.5 h-3 w-3 flex-none" />
                      <span className="min-w-0 break-words">{row.note}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
