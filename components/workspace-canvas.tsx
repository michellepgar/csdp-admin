"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { ReactNode } from "react";
import { BellRing, ChevronDown, LayoutGrid, Palette, Plus, StickyNote, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceBlockFrame } from "@/components/workspace-block-frame";
import { WorkspaceNoteBlock } from "@/components/workspace-note-block";
import { WorkspaceReminderBlock } from "@/components/workspace-reminder-block";
import { WorkspaceSheetTabs } from "@/components/workspace-sheet-tabs";
import type { WorkspaceAction } from "@/components/workspace-sheet-tabs";
import { WorkspaceTableBlock } from "@/components/workspace-table-block";
import { BG_COLORS, BG_STYLES, defaultContent, defaultRect, findFreePosition, isDarkColor } from "@/lib/workspace";
import type { BgStyle } from "@/lib/workspace";
import type { Block, BlockContent, BlockKind, NoteContent, Rect, ReminderContent, Sheet, TableContent, Workbook } from "@/lib/workspace";

const MOBILE_QUERY = "(max-width: 639px)";
const CONTENT_DEBOUNCE_MS = 600;
const CANVAS_SLACK = 240;
const SAVE_FAILED = "Couldn't save your changes. They're kept here -- try again in a moment.";

/* Below Tailwind's `sm` breakpoint: no drag/resize, blocks stack in one
   column. Starts false on the server (and the first client render) and
   updates once the real media query is known, so hydration always agrees. */
function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

const KIND_META: Record<BlockKind, { label: string; icon: ReactNode; chip: string }> = {
  table: { label: "Table", icon: <Table2 className="h-4 w-4" />, chip: "bg-muted text-muted-foreground" },
  note: { label: "Note", icon: <StickyNote className="h-4 w-4" />, chip: "bg-muted text-muted-foreground" },
  reminder: { label: "Reminder", icon: <BellRing className="h-4 w-4" />, chip: "bg-muted text-muted-foreground" },
};
const KINDS: BlockKind[] = ["table", "note", "reminder"];

const STYLE_LABELS: Record<BgStyle, string> = { dots: "Dots", grid: "Grid", plain: "Plain" };

/* The canvas pattern for a style, drawn in a line color that reads on the chosen background. */
function patternFor(style: BgStyle, color: string): { backgroundImage?: string; backgroundSize?: string } {
  const ink = color ? (isDarkColor(color) ? "rgb(255 255 255 / 0.16)" : "rgb(0 0 0 / 0.16)") : "color-mix(in oklab, var(--foreground) 22%, transparent)";
  if (style === "plain") return {};
  if (style === "grid") return { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: "24px 24px" };
  return { backgroundImage: `radial-gradient(circle, ${ink} 1px, transparent 1.6px)`, backgroundSize: "24px 24px" };
}

type SaveState = {
  timer: ReturnType<typeof setTimeout> | null;
  /** Content waiting to be sent (also kept after a failed send so Retry works). */
  pending: BlockContent | null;
  inFlight: boolean;
  /** Rect saves run one after another so an older one can never land last. */
  rectChain: Promise<void>;
};
type BlockErrors = { content?: string; rect?: string; action?: string };

/* Stable stand-in for a table block whose stored content is malformed (fresh
   random ids every render would remount every cell). */
const tableFallbacks = new Map<string, TableContent>();
function tableFallback(id: string): TableContent {
  let table = tableFallbacks.get(id);
  if (!table) {
    table = defaultContent("table") as TableContent;
    tableFallbacks.set(id, table);
  }
  return table;
}

const reminderFallbacks = new Map<string, ReminderContent>();
function reminderFallback(id: string): ReminderContent {
  let reminder = reminderFallbacks.get(id);
  if (!reminder) {
    reminder = defaultContent("reminder") as ReminderContent;
    reminderFallbacks.set(id, reminder);
  }
  return reminder;
}

const rectKey =(r: Rect & { z: number }) => `${r.x},${r.y},${r.w},${r.h},${r.z}`;

/* One workbook: the sheet tabs, an "Add block" menu, and the active sheet's
   free-form canvas.

   STATE RULE. The canvas keeps its OWN copy of every block (`blocks`).
   updateBlockContent / updateBlockRect deliberately don't revalidate, so the
   server props never change after them; structural actions (create/delete
   block, sheet changes) do revalidate and deliver new props. Props are merged
   into local state by ID only: a block already known locally is NEVER
   overwritten from props (it may hold unsaved text or an in-flight save);
   only blocks that are new to the props are added and blocks that vanished
   are dropped. A slow save response never touches block content either -- it
   only clears/sets an error flag. */
export function WorkspaceCanvas({
  workbook,
  sheets,
  blocks: propBlocks,
  initialSheetId,
  touchWorkbook,
  setWorkbookBackground,
  createSheet,
  renameSheet,
  reorderSheets,
  deleteSheet,
  createBlock,
  updateBlockContent,
  updateBlockRect,
  deleteBlock,
}: {
  workbook: Workbook;
  sheets: Sheet[];
  blocks: Block[];
  /** The sheet named by ?sheet= (validated by the page), or the first sheet. */
  initialSheetId: string | null;
  touchWorkbook: WorkspaceAction;
  setWorkbookBackground: WorkspaceAction;
  createSheet: WorkspaceAction;
  renameSheet: WorkspaceAction;
  reorderSheets: WorkspaceAction;
  deleteSheet: WorkspaceAction;
  createBlock: WorkspaceAction;
  updateBlockContent: WorkspaceAction;
  updateBlockRect: WorkspaceAction;
  deleteBlock: WorkspaceAction;
}) {
  const mobile = useIsMobile();
  const [blocks, setBlocks] = useState<Block[]>(propBlocks);
  const [activeId, setActiveId] = useState<string | null>(initialSheetId);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, BlockErrors>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [bgColor, setBgColor] = useState(workbook.bgColor ?? "");
  const [bgStyle, setBgStyle] = useState<BgStyle>((workbook.bgStyle as BgStyle | undefined) ?? "dots");
  const [adding, startAdding] = useTransition();
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  const saves = useRef(new Map<string, SaveState>());
  const savedRects = useRef(new Map<string, string>());
  const deletedIds = useRef(new Set<string>());

  const activeSheet = sheets.find((s) => s.id === activeId) ?? sheets[0] ?? null;

  /* ---- merge server props into local state (by id only) ---- */
  useEffect(() => {
    setBlocks((prev) => {
      const propIds = new Set(propBlocks.map((b) => b.id));
      const known = new Set(prev.map((b) => b.id));
      const kept = prev.filter((b) => propIds.has(b.id));
      const added = propBlocks.filter((b) => !known.has(b.id) && !deletedIds.current.has(b.id));
      return kept.length === prev.length && added.length === 0 ? prev : [...kept, ...added];
    });
    for (const b of propBlocks) {
      if (!savedRects.current.has(b.id)) savedRects.current.set(b.id, rectKey(b));
    }
  }, [propBlocks]);

  /* ---- content saves ---- */
  function saveState(id: string): SaveState {
    let state = saves.current.get(id);
    if (!state) {
      state = { timer: null, pending: null, inFlight: false, rectChain: Promise.resolve() };
      saves.current.set(id, state);
    }
    return state;
  }

  function setBlockError(id: string, slot: keyof BlockErrors, message: string | null) {
    setErrors((prev) => {
      const current = prev[id] ?? {};
      if ((current[slot] ?? null) === message) return prev;
      const next = { ...current };
      if (message) next[slot] = message;
      else delete next[slot];
      return { ...prev, [id]: next };
    });
  }

  async function sendContent(id: string) {
    const state = saves.current.get(id);
    if (!state || state.inFlight || state.pending === null) return;
    const content = state.pending;
    state.pending = null;
    state.inFlight = true;
    const formData = new FormData();
    formData.set("id", id);
    formData.set("content", JSON.stringify(content));
    let failure: string | null = null;
    try {
      const result = await updateBlockContent(formData);
      failure = result.error;
    } catch {
      // An over-size request (Next's 4 MB body limit) throws a redacted error.
      failure = SAVE_FAILED;
    }
    state.inFlight = false;
    if (failure) {
      // Keep the unsaved content so Retry / the next blur sends it again; the
      // local copy is never touched.
      if (state.pending === null) state.pending = content;
      setBlockError(id, "content", failure);
      return;
    }
    setBlockError(id, "content", null);
    if (state.pending !== null && !state.timer) void sendContent(id);
  }

  function flushContent(id: string) {
    const state = saves.current.get(id);
    if (!state) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.pending !== null) void sendContent(id);
  }

  function flushAll() {
    for (const id of [...saves.current.keys()]) flushContent(id);
  }

  function changeContent(id: string, content: BlockContent) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
    const state = saveState(id);
    state.pending = content;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = null;
      void sendContent(id);
    }, CONTENT_DEBOUNCE_MS);
  }

  /* Flush whatever is unsaved when leaving the page or closing the tab. */
  const flushAllRef = useRef(flushAll);
  useEffect(() => {
    flushAllRef.current = flushAll;
  });
  useEffect(() => {
    const flush = () => flushAllRef.current();
    const flushIfHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flushIfHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flushIfHidden);
      flush();
    };
  }, []);

  /* Opening a workbook moves it to the top of "last opened". */
  useEffect(() => {
    const formData = new FormData();
    formData.set("id", workbook.id);
    touchWorkbook(formData).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbook.id]);

  function changeBackground(color: string, style: BgStyle) {
    const previous = { color: bgColor, style: bgStyle };
    setBgColor(color);
    setBgStyle(style);
    const formData = new FormData();
    formData.set("id", workbook.id);
    formData.set("color", color);
    formData.set("style", style);
    setWorkbookBackground(formData)
      .then((result) => {
        if (result.error) throw new Error(result.error);
      })
      .catch(() => {
        setBgColor(previous.color);
        setBgStyle(previous.style);
        setNotice("Couldn't save the background. Try again in a moment.");
      });
  }

  /* ---- rect saves ---- */
  function saveRect(id: string, rect: Rect & { z: number }) {
    const key = rectKey(rect);
    if (savedRects.current.get(id) === key) return;
    savedRects.current.set(id, key);
    const state = saveState(id);
    state.rectChain = state.rectChain.then(async () => {
      const formData = new FormData();
      formData.set("id", id);
      for (const field of ["x", "y", "w", "h", "z"] as const) formData.set(field, String(rect[field]));
      let failure: string | null = null;
      try {
        failure = (await updateBlockRect(formData)).error;
      } catch {
        failure = SAVE_FAILED;
      }
      if (failure) {
        // Forget it so the next drag/resize end tries again; the local rect stays.
        if (savedRects.current.get(id) === key) savedRects.current.delete(id);
        setBlockError(id, "rect", failure);
      } else {
        setBlockError(id, "rect", null);
      }
    });
  }

  function changeRect(id: string, rect: Rect) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...rect } : b)));
  }

  /* Re-sends the block's current rect after a failed rect save. */
  function retryRect(id: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    savedRects.current.delete(id);
    saveRect(id, { x: block.x, y: block.y, w: block.w, h: block.h, z: block.z });
  }

  function commitRect(id: string, rect: Rect) {
    const block = blocks.find((b) => b.id === id);
    if (block) saveRect(id, { ...rect, z: block.z });
  }

  /* Pressing a block raises it above the others on its sheet and saves that. */
  function activateBlock(id: string) {
    setSelectedBlockId(id);
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const highestOther = blocks.reduce((max, other) => (other.sheetId === block.sheetId && other.id !== id ? Math.max(max, other.z) : max), -1);
    if (block.z > highestOther) return;
    const z = highestOther + 1;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, z } : b)));
    saveRect(id, { x: block.x, y: block.y, w: block.w, h: block.h, z });
  }

  /* ---- sheets ---- */
  function selectSheet(id: string) {
    flushAll();
    setActiveId(id);
    setSelectedBlockId(null);
    try {
      // Keeps a refresh on the same tab without a server round-trip that
      // would re-fetch every block just to change the tab.
      const url = new URL(window.location.href);
      url.searchParams.set("sheet", id);
      window.history.replaceState(null, "", url);
    } catch {
      // The URL is a convenience; the tab still switches.
    }
  }

  /* Select a newly created sheet once it has arrived in the props. */
  useEffect(() => {
    if (pendingSelectId && sheets.some((s) => s.id === pendingSelectId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot handoff once the new sheet exists in the props.
      selectSheet(pendingSelectId);
      setPendingSelectId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, pendingSelectId]);

  /* ---- blocks ---- */
  const sheetBlocks = activeSheet ? blocks.filter((b) => b.sheetId === activeSheet.id) : [];

  function addBlock(kind: BlockKind) {
    setMenuOpen(false);
    if (!activeSheet) return;
    const size = defaultRect(kind);
    const spot = findFreePosition(sheetBlocks, size);
    const formData = new FormData();
    formData.set("sheetId", activeSheet.id);
    formData.set("kind", kind);
    formData.set("x", String(spot.x));
    formData.set("y", String(spot.y));
    startAdding(async () => {
      try {
        const result = await createBlock(formData);
        setNotice(result.error);
      } catch {
        setNotice("Couldn't add the block. Please try again.");
      }
    });
  }

  async function removeBlock(block: Block) {
    if (!window.confirm(`Delete this ${KIND_META[block.kind].label.toLowerCase()} block? This can't be undone.`)) return;
    await performDelete(block);
  }

  async function performDelete(block: Block) {
    const formData = new FormData();
    formData.set("id", block.id);
    setBlockError(block.id, "action", null);
    let failure: string | null = null;
    try {
      failure = (await deleteBlock(formData)).error;
    } catch {
      failure = "Couldn't delete the block. Please try again.";
    }
    if (failure) {
      // The block, its pending edit and its timer are all left untouched.
      setBlockError(block.id, "action", failure);
      return;
    }
    // Only now is the block really gone, so only now drop its save state.
    const state = saves.current.get(block.id);
    if (state?.timer) clearTimeout(state.timer);
    deletedIds.current.add(block.id);
    saves.current.delete(block.id);
    savedRects.current.delete(block.id);
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[block.id];
      return next;
    });
  }

  /* The body of a block. Table and reminder bodies plug in here (Tasks 7-8). */
  function renderBody(block: Block) {
    if (block.kind === "note") {
      const html = typeof (block.content as Partial<NoteContent>).html === "string" ? (block.content as NoteContent).html : "";
      return <WorkspaceNoteBlock key={block.id} content={{ html, padColor: (block.content as NoteContent).padColor }} onChange={(content) => changeContent(block.id, content)} onFlush={() => flushContent(block.id)} />;
    }
    if (block.kind === "table") {
      const raw = block.content as Partial<TableContent>;
      const table: TableContent = Array.isArray(raw.columns) && Array.isArray(raw.rows) && raw.columns.length > 0 ? (raw as TableContent) : tableFallback(block.id);
      return <WorkspaceTableBlock key={block.id} content={table} mobile={mobile} onChange={(content) => changeContent(block.id, content)} onFlush={() => flushContent(block.id)} />;
    }
    const rawReminder = block.content as Partial<ReminderContent>;
    const reminder: ReminderContent =
      typeof rawReminder.text === "string" && typeof rawReminder.done === "boolean" && (rawReminder.due === null || typeof rawReminder.due === "string")
        ? (rawReminder as ReminderContent)
        : reminderFallback(block.id);
    return <WorkspaceReminderBlock key={block.id} content={reminder} onChange={(content) => changeContent(block.id, content)} onFlush={() => flushContent(block.id)} />;
  }

  function renderBlock(block: Block) {
    const meta = KIND_META[block.kind];
    const blockErrors = errors[block.id];
    return (
      <WorkspaceBlockFrame
        key={block.id}
        block={block}
        active={selectedBlockId === block.id}
        mobile={mobile}
        title={meta.label}
        icon={meta.icon}
        error={blockErrors?.action ?? blockErrors?.content ?? blockErrors?.rect ?? null}
        onRetry={
          blockErrors?.action
            ? () => void performDelete(block)
            : blockErrors?.content
              ? () => flushContent(block.id)
              : blockErrors?.rect
                ? () => retryRect(block.id)
                : undefined
        }
        onActivate={() => activateBlock(block.id)}
        onRectChange={(rect) => changeRect(block.id, rect)}
        onRectCommit={(rect) => commitRect(block.id, rect)}
        onDelete={() => void removeBlock(block)}
      >
        {renderBody(block)}
      </WorkspaceBlockFrame>
    );
  }

  const right = sheetBlocks.reduce((max, b) => Math.max(max, b.x + b.w), 0);
  const bottom = sheetBlocks.reduce((max, b) => Math.max(max, b.y + b.h), 0);
  const ordered = [...sheetBlocks].sort((a, b) => a.y - b.y || a.x - b.x);

  const emptyState = (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <LayoutGrid className="h-6 w-6" />
      </span>
      <p className="text-sm text-muted-foreground">This sheet is empty. Add a block to start.</p>
    </div>
  );

  return (
    <div className="overflow-visible rounded-xl border border-border bg-record-background shadow-sm">
      <div className="relative z-20 flex flex-wrap items-end gap-2 rounded-t-xl border-b border-border bg-muted/50 px-2 pt-2">
        {activeSheet && (
          <WorkspaceSheetTabs
            workbookId={workbook.id}
            sheets={sheets}
            activeId={activeSheet.id}
            onSelect={selectSheet}
            onCreated={setPendingSelectId}
            onDeleted={(deletedId, fallbackId) => {
              if (deletedId === activeSheet.id && fallbackId) selectSheet(fallbackId);
            }}
            createSheet={createSheet}
            renameSheet={renameSheet}
            reorderSheets={reorderSheets}
            deleteSheet={deleteSheet}
          />
        )}
        <div className="relative mb-2 ml-auto flex items-center gap-2">
        <div
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape") setBgOpen(false);
          }}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => setBgOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={bgOpen} title="Change the background">
            <Palette className="mr-1 h-4 w-4" />
            Background
          </Button>
          {bgOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setBgOpen(false)} aria-hidden />
              <div role="dialog" aria-label="Background" className="absolute right-0 top-full z-40 mt-1 w-64 space-y-3 rounded-lg border border-border bg-record-background p-3 shadow-xl">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {BG_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={bgColor === c.value}
                        onClick={() => changeBackground(c.value, bgStyle)}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] text-muted-foreground transition-transform hover:scale-110 ${bgColor === c.value ? "border-primary" : "border-border"}`}
                        style={c.value ? { backgroundColor: c.value } : undefined}
                      >
                        {c.value ? "" : "A"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</p>
                  <div className="flex gap-1.5">
                    {BG_STYLES.map((s) => (
                      <Button key={s} type="button" size="sm" variant={bgStyle === s ? "default" : "outline"} aria-pressed={bgStyle === s} onClick={() => changeBackground(bgColor, s)}>
                        {STYLE_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <div
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenuOpen(false);
          }}
        >
          <Button type="button" size="sm" onClick={() => setMenuOpen((open) => !open)} disabled={!activeSheet || adding} aria-haspopup="menu" aria-expanded={menuOpen}>
            <Plus className="mr-1 h-4 w-4" />
            {adding ? "Adding…" : "Add block"}
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
              <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-ring/30 bg-record-background py-1 shadow-xl">
                {KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => addBlock(kind)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-ring/10"
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${KIND_META[kind].chip}`}>{KIND_META[kind].icon}</span>
                    {KIND_META[kind].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {notice && (
        <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {notice}
        </p>
      )}

      {mobile ? (
        <div className="flex flex-col gap-3 rounded-b-xl bg-muted/30 p-3" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          {ordered.length === 0 ? emptyState : ordered.map(renderBlock)}
        </div>
      ) : (
        <div className="relative isolate h-[calc(100vh-17rem)] min-h-[420px] overflow-auto rounded-b-xl bg-muted/30" style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div
            className="relative"
            style={{
              minWidth: `max(100%, ${right + CANVAS_SLACK}px)`,
              minHeight: `max(100%, ${bottom + CANVAS_SLACK}px)`,
              ...patternFor(bgStyle, bgColor),
            }}
          >
            {sheetBlocks.map(renderBlock)}
            {sheetBlocks.length === 0 && <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">{emptyState}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
