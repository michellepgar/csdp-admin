"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronDown, Moon, PanelLeft, Plus, Search, Sun } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { MentionsBell } from "@/components/mentions-bell";
import { QuickAddDialog, type QuickAddData } from "@/components/quick-add-dialog";
import { SignOutButton } from "@/components/sign-out-button";
import type { Mention } from "@/lib/app-state";
import type { PrivateNoteHit } from "@/app/(app)/private-notes/actions";

/* The bar across the very top of every page: the sidebar toggle, the app
   name, jump-to-anything search, Quick add, notifications and the account
   menu. It used to be split up -- the name and collapse button lived in
   the sidebar's corner, notifications and Sign out at the bottom of the
   sidebar -- so the sidebar could only ever show them when it was open. */

/* A small click-to-open panel under a header button. Closes on an outside
   click or Escape. */
function HeaderMenu({
  label,
  trigger,
  triggerClassName,
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  triggerClassName: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-background p-1.5 text-foreground shadow-xl ring-1 ring-black/5"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const MENU_ITEM = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-muted";

function ThemeRow() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} className={MENU_ITEM}>
      {dark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
      {dark ? "Switch to light mode" : "Switch to dark mode"}
    </button>
  );
}

export function AppTopBar({
  onToggleSidebar,
  sidebarCollapsed,
  schools,
  isAdmin,
  showMyWorkspace,
  currentName,
  currentColor,
  myMentions,
  markMentionRead,
  quickAdd,
  searchNotes,
}: {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
  showMyWorkspace: boolean;
  currentName: string;
  currentColor?: string;
  myMentions: Mention[];
  markMentionRead: (formData: FormData) => void;
  quickAdd: QuickAddData;
  searchNotes: (query: string) => Promise<PrivateNoteHit[]>;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const iconButton =
    "relative flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-white/25";

  return (
    <header className="sticky top-0 z-50 flex h-14 flex-none items-center gap-2 bg-header-background px-3 text-white sm:gap-3 sm:px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Show full sidebar" : "Collapse sidebar"}
        title={sidebarCollapsed ? "Show full sidebar" : "Collapse sidebar"}
        className={iconButton}
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <Link href="/overview" prefetch={false} className="hidden flex-none text-lg font-bold sm:block">
        CSDP Tracker
      </Link>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search pages, schools and notes"
        className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-left text-sm text-slate-500 shadow-sm transition-colors hover:border-black/25 dark:bg-slate-900 dark:text-slate-400"
      >
        <Search className="h-4 w-4 flex-none" />
        <span className="min-w-0 flex-1 truncate">Search pages, schools and notes…</span>
        <kbd className="hidden flex-none rounded border bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:block dark:bg-slate-800 dark:text-slate-300">Ctrl K</kbd>
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Quick add"
        className="flex h-9 flex-none items-center gap-1.5 rounded-lg border border-black/20 bg-[#0C3B4A] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.3)] transition-colors hover:bg-[#0A2F3B]"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Quick add</span>
      </button>

      <MentionsBell mentions={myMentions} markMentionRead={markMentionRead} variant="topbar" />

      <HeaderMenu
        label="Account"
        triggerClassName="flex h-9 flex-none items-center gap-2 rounded-full border border-white/30 bg-white/15 py-0.5 pl-0.5 pr-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-white/25"
        trigger={
          <>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C3B4A] text-xs font-bold text-white"
              style={currentColor ? { backgroundColor: currentColor } : undefined}
            >
              {currentName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-24 truncate sm:inline">{currentName}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        }
      >
        {() => (
          <>
            <div className="px-2.5 pb-1.5 pt-1 text-xs text-muted-foreground">Signed in as {currentName}</div>
            <ThemeRow />
            <div className="my-1 border-t" />
            <SignOutButton collapsed={false} />
          </>
        )}
      </HeaderMenu>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} schools={schools} isAdmin={isAdmin} showMyWorkspace={showMyWorkspace} searchNotes={searchNotes} />
      {quickAddOpen && <QuickAddDialog onClose={() => setQuickAddOpen(false)} data={quickAdd} />}
    </header>
  );
}
