"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  Contact,
  DatabaseBackup,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  School,
  Search,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaletteItem = { key: string; label: string; hint: string; href: string; icon: LucideIcon };

const PAGES: PaletteItem[] = [
  { key: "p-overview", label: "Overview", hint: "Page", href: "/overview", icon: LayoutDashboard },
  { key: "p-private", label: "Private Notes", hint: "Page", href: "/private-notes", icon: Lock },
  { key: "p-messages", label: "Messages", hint: "Page", href: "/messages", icon: MessageSquare },
  { key: "p-general-tasks", label: "General Tasks", hint: "Page", href: "/general-tasks", icon: ClipboardList },
  { key: "p-general-notes", label: "General Notes", hint: "Page", href: "/notes", icon: Megaphone },
  { key: "p-issues", label: "Issues & Concerns", hint: "Page", href: "/issues", icon: AlertTriangle },
  { key: "p-eod", label: "EOD Reports", hint: "Page", href: "/eod", icon: Clock },
  { key: "p-contacts", label: "Schools Contact Information", hint: "Page", href: "/contacts", icon: Contact },
  { key: "p-distribution", label: "Distribution List", hint: "Page", href: "/distribution-list", icon: Send },
  { key: "p-templates", label: "Email Templates", hint: "Page", href: "/templates", icon: Mail },
  { key: "p-suggestions", label: "Suggestions", hint: "Page", href: "/suggestions", icon: MessageSquarePlus },
];

const ADMIN_PAGES: PaletteItem[] = [
  { key: "p-team", label: "Team", hint: "Admin", href: "/team", icon: Users },
  { key: "p-backup", label: "Backup & School Year", hint: "Admin", href: "/admin-settings", icon: DatabaseBackup },
];

/* Jump-to-anywhere search (Ctrl/Cmd + K, or the search box in the top bar):
   type a few letters of a page or a school and press Enter. */
export function CommandPalette({
  open,
  onClose,
  schools,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const schoolItems: PaletteItem[] = [...schools]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ key: `s-${s.id}`, label: s.name, hint: "School", href: `/schools/${s.id}`, icon: School }));
    const all = [...PAGES, ...(isAdmin ? ADMIN_PAGES : []), ...schoolItems];
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length === 0 ? all : all.filter((item) => words.every((w) => item.label.toLowerCase().includes(w)));
  }, [schools, isAdmin, query]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Each time the palette opens it starts from an empty search.
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, items]);

  if (!open || typeof document === "undefined") return null;

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 px-3 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border bg-background shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 flex-none text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page or a school"
            aria-label="Search"
            className="h-12 w-full border-0 bg-transparent px-1 text-base shadow-none outline-none focus-visible:ring-0"
          />
          <kbd className="flex-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    i === active ? "bg-ring/10 text-foreground" : "text-foreground/90",
                  )}
                >
                  <Icon className="h-4 w-4 flex-none text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="flex-none text-xs text-muted-foreground">{item.hint}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
