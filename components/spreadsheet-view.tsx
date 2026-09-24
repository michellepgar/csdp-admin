"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSheetTabs } from "@/components/workspace-sheet-tabs";
import type { WorkspaceAction } from "@/components/workspace-sheet-tabs";
import { WorkspaceTableBlock } from "@/components/workspace-table-block";
import { createClient } from "@/lib/supabase/client";
import { applySheetOps } from "@/lib/sheet-ops";
import type { SheetOp } from "@/lib/sheet-ops";
import { readGrid } from "@/lib/spreadsheets";
import type { SheetContent, Spreadsheet, SpreadsheetSheet } from "@/lib/spreadsheets";
import type { TableContent } from "@/lib/workspace";
import { lastSheet, rememberSheet } from "@/lib/workspace-last-place";

const SAVE_DELAY_MS = 350;
const RETRY_DELAY_MS = 4000;
const REFETCH_DELAY_MS = 150;
const FALLBACK_POLL_MS = 20000;
/* One save request carries at most this much, so a big burst of edits never
   exceeds what the server accepts; the rest follows in the next request. */
const MAX_BATCH_OPS = 400;
const MAX_BATCH_CELLS = 20000;

type SaveCode = "invalid" | "tooBig" | "gone" | "busy" | "retry";
type SaveResult = { error: string | null; version?: number; code?: SaveCode };
type FetchResult = { error: string | null; sheet?: SheetContent };

/* A realtime channel takes a moment to leave; joining the same topic again
   before it has left hands back the old, closing channel (and the new join
   silently does nothing). So a new join waits for the previous leave. */
const leaving = new Map<string, Promise<unknown>>();

/* One sheet's sync state. `base` is the last copy known to match the server
   at `version`; `inflight` is the batch being saved; `pending` holds newer
   edits not sent yet. The grid always shows base + inflight + pending, so a
   fresher copy from someone else can be swapped in underneath at any time and
   the unsaved edits replayed on top (every operation is safe to repeat -- see
   lib/sheet-ops.ts). Sessions are kept per sheet, so switching tabs never
   strands unsaved edits. */
type Session = {
  sheetId: string;
  base: TableContent;
  version: number;
  inflight: SheetOp[];
  pending: SheetOp[];
  sending: boolean;
  gone: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  refetchTimer: ReturnType<typeof setTimeout> | null;
};

const newSession = (sheetId: string, sheet: SheetContent): Session => ({
  sheetId,
  base: sheet.content,
  version: sheet.version,
  inflight: [],
  pending: [],
  sending: false,
  gone: false,
  timer: null,
  refetchTimer: null,
});

const shown = (s: Session) => applySheetOps(s.base, [...s.inflight, ...s.pending]);
const unsaved = (s: Session) => !s.gone && (s.pending.length > 0 || s.inflight.length > 0);

function opCells(op: SheetOp): number {
  return "cells" in op ? op.cells.length : 1;
}

/* Takes the next save-sized batch off the front of the queue (always at least one operation). */
function takeBatch(pending: SheetOp[]): SheetOp[] {
  let cells = 0;
  let count = 0;
  while (count < pending.length && count < MAX_BATCH_OPS) {
    const size = opCells(pending[count]);
    if (count > 0 && cells + size > MAX_BATCH_CELLS) break;
    cells += size;
    count++;
  }
  return pending.splice(0, count);
}

export function SpreadsheetView({
  spreadsheet,
  sheets: sheetList,
  initialSheetId,
  initialContent,
  sheetFromUrl,
  me,
  demo,
  createSheet,
  renameSheet,
  reorderSheets,
  deleteSheet,
  saveSheetOps,
  fetchSheetContent,
}: {
  spreadsheet: Spreadsheet;
  sheets: SpreadsheetSheet[];
  initialSheetId: string | null;
  initialContent: SheetContent | null;
  sheetFromUrl: boolean;
  me: string;
  demo: boolean;
  createSheet: WorkspaceAction;
  renameSheet: WorkspaceAction;
  reorderSheets: WorkspaceAction;
  deleteSheet: WorkspaceAction;
  saveSheetOps: (formData: FormData) => Promise<SaveResult>;
  fetchSheetContent: (sheetId: string) => Promise<FetchResult>;
}) {
  const router = useRouter();
  const tabs = sheetList.map((s) => ({ id: s.id, workbookId: s.spreadsheetId, name: s.name, sortOrder: s.sortOrder }));
  const [activeId, setActiveId] = useState<string | null>(initialSheetId);
  const [content, setContent] = useState<TableContent | null>(initialContent?.content ?? null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [notice, setNotice] = useState<string | null>(initialSheetId && !initialContent ? "This sheet couldn't be loaded. Reload the page to try again." : null);
  const [viewers, setViewers] = useState<string[]>([]);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [addingSheet, setAddingSheet] = useState(false);

  const [firstSession] = useState(() => (initialSheetId && initialContent ? newSession(initialSheetId, initialContent) : null));
  const sessions = useRef(new Map<string, Session>(firstSession ? [[firstSession.sheetId, firstSession]] : []));
  const current = useRef<Session | null>(firstSession);
  const requested = useRef<string | null>(initialSheetId);

  /* Everything the long-lived callbacks need, always current (the server
     actions arrive as new function objects on every page refresh, and the
     live connection must not be rebuilt each time). */
  const latest = useRef({ saveSheetOps, fetchSheetContent, sheetList, router });
  useLayoutEffect(() => {
    latest.current = { saveSheetOps, fetchSheetContent, sheetList, router };
  });

  const [helpers] = useState(() => {
    const showIfOpen = (s: Session) => {
      if (current.current === s) setContent(shown(s));
    };

    /* The newest saved copy of a sheet: straight from the database for a real
       account (so it never waits behind a save), from the demo cookies otherwise. */
    const load = async (sheetId: string): Promise<FetchResult> => {
      if (demo) return latest.current.fetchSheetContent(sheetId);
      const { data, error } = await createClient().from("spreadsheet_sheet_content").select("content, version").eq("sheet_id", sheetId).maybeSingle();
      if (error) return { error: "Couldn't load this sheet. Please try again." };
      if (!data) return { error: "This sheet was deleted by someone else." };
      return { error: null, sheet: { content: readGrid(data.content), version: Number(data.version) } };
    };

    const refetch = async (s: Session) => {
      if (s.gone) return;
      let result: FetchResult;
      try {
        result = await load(s.sheetId);
      } catch {
        return;
      }
      if (!result.sheet || result.sheet.version < s.version) return;
      s.base = result.sheet.content;
      s.version = result.sheet.version;
      showIfOpen(s);
    };

    const scheduleRefetch = (s: Session) => {
      if (s.refetchTimer) clearTimeout(s.refetchTimer);
      s.refetchTimer = setTimeout(() => {
        s.refetchTimer = null;
        void refetch(s);
      }, REFETCH_DELAY_MS);
    };

    const report = (s: Session) => {
      if (current.current !== s) return;
      setStatus(s.pending.length > 0 || s.inflight.length > 0 ? "saving" : "saved");
    };

    const send = async (s: Session): Promise<void> => {
      if (s.timer) {
        clearTimeout(s.timer);
        s.timer = null;
      }
      if (s.gone || s.sending || s.pending.length === 0) return;
      s.sending = true;
      s.inflight = takeBatch(s.pending);
      report(s);
      const formData = new FormData();
      formData.set("sheetId", s.sheetId);
      formData.set("ops", JSON.stringify(s.inflight));
      let result: SaveResult;
      try {
        result = await latest.current.saveSheetOps(formData);
      } catch {
        result = { error: "Couldn't save your change. It's kept here; trying again shortly.", code: "retry" };
      }
      const batch = s.inflight;
      s.inflight = [];
      s.sending = false;

      if (result.error || result.version === undefined) {
        const code = result.code ?? "retry";
        if (code === "busy" || code === "retry") {
          // Worth another try: keep the edits (in order) and retry shortly.
          s.pending = [...batch, ...s.pending];
          if (current.current === s) {
            setStatus("error");
            setNotice(result.error);
          }
          s.timer = setTimeout(() => void send(s), RETRY_DELAY_MS);
          return;
        }
        if (code === "gone") {
          // The sheet was deleted by someone else: nothing more can be saved to it.
          s.gone = true;
          s.pending = [];
          if (current.current === s) setNotice(result.error);
          latest.current.router.refresh();
          return;
        }
        // Can never succeed ("invalid", "tooBig"): drop this batch, show the saved copy, keep going.
        if (current.current === s) setNotice(result.error);
        void refetch(s);
        showIfOpen(s);
      } else if (result.version > s.version) {
        const jumped = result.version !== s.version + 1;
        s.base = applySheetOps(s.base, batch);
        if (jumped) void refetch(s); // someone else saved in between: pull in the combined copy
        else s.version = result.version;
        if (current.current === s) setNotice(null);
      }
      report(s);
      if (s.pending.length > 0) void send(s);
    };

    return { load, refetch, scheduleRefetch, send, showIfOpen };
  });

  function onTableChange(_next: TableContent, ops: SheetOp[]) {
    const s = current.current;
    if (!s || s.gone) return;
    s.pending.push(...ops);
    setContent(shown(s));
    setStatus("saving");
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => void helpers.send(s), SAVE_DELAY_MS);
  }

  async function openSheet(id: string) {
    if (current.current?.sheetId === id && requested.current === id) return;
    const previous = current.current;
    if (previous) void helpers.send(previous); // keep saving the sheet being left
    requested.current = id;
    setActiveId(id);
    rememberSheet(spreadsheet.id, id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("sheet", id);
      window.history.replaceState(null, "", url);
    } catch {
      // The address is a convenience; the tab still switches.
    }

    // Back to a sheet opened before: show it straight away (unsaved edits included), then freshen it.
    const known = sessions.current.get(id);
    if (known && !known.gone) {
      current.current = known;
      setNotice(null);
      setLoading(false);
      setContent(shown(known));
      setStatus(unsaved(known) ? "saving" : "saved");
      void helpers.refetch(known);
      return;
    }

    current.current = null;
    setContent(null);
    setLoading(true);
    let result: FetchResult;
    try {
      result = await helpers.load(id);
    } catch {
      result = { error: "Couldn't load this sheet. Please try again." };
    }
    if (requested.current !== id) return; // another tab was picked meanwhile
    setLoading(false);
    if (!result.sheet) {
      setNotice(result.error);
      return;
    }
    const s = newSession(id, result.sheet);
    sessions.current.set(id, s);
    current.current = s;
    setNotice(null);
    setStatus("saved");
    setContent(result.sheet.content);
  }
  const openSheetRef = useRef(openSheet);
  useLayoutEffect(() => {
    openSheetRef.current = openSheet;
  });

  /* Reopen the sheet this spreadsheet was left on in this browser (unless the address names one). */
  useEffect(() => {
    const saved = sheetFromUrl ? null : lastSheet(spreadsheet.id);
    if (saved && saved !== activeId && sheetList.some((s) => s.id === saved)) void openSheetRef.current(saved);
    else if (activeId) rememberSheet(spreadsheet.id, activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Select a newly created sheet once it has arrived in the props. */
  useEffect(() => {
    if (pendingSelectId && sheetList.some((s) => s.id === pendingSelectId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-shot handoff once the new sheet exists in the props.
      setPendingSelectId(null);
      void openSheetRef.current(pendingSelectId);
    }
  }, [sheetList, pendingSelectId]);

  /* The open sheet was deleted (here or by someone else): move to the first remaining one. */
  useEffect(() => {
    if (activeId && sheetList.length > 0 && !sheetList.some((s) => s.id === activeId)) void openSheetRef.current(sheetList[0].id);
  }, [sheetList, activeId]);

  /* Save right away when hiding or leaving the page, and warn before closing with unsaved edits. */
  useEffect(() => {
    const all = sessions.current;
    const flush = () => {
      for (const s of all.values()) void helpers.send(s);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if ([...all.values()].some(unsaved)) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
    };
  }, [helpers]);

  /* Live updates and "who's here", over a private realtime channel for this
     spreadsheet (supabase/phase76_shared_spreadsheets.sql). Not available in
     the demo, which has no real database. Whenever the connection (re)opens,
     the open sheet and the tabs are re-read, so nothing missed while it was
     down stays missing; if it can't be opened, the open sheet is re-checked
     every 20 seconds instead. */
  useEffect(() => {
    if (demo) return;
    const supabase = createClient();
    const topic = `spreadsheet:${spreadsheet.id}`;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshTabs = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => latest.current.router.refresh(), 300);
    };
    const catchUp = () => {
      const s = current.current;
      if (s) helpers.scheduleRefetch(s);
    };
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(() => {
        const s = current.current;
        if (s && document.visibilityState === "visible" && !s.sending && s.pending.length === 0) void helpers.refetch(s);
      }, FALLBACK_POLL_MS);
    };

    void (async () => {
      await leaving.get(topic);
      const {
        data: { session: auth },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (auth?.access_token) await supabase.realtime.setAuth(auth.access_token);
      if (cancelled) return;
      const joined = supabase.channel(topic, { config: { private: true, presence: { key: me } } });
      channel = joined;
      joined
        .on("postgres_changes", { event: "*", schema: "public", table: "spreadsheet_sheets", filter: `spreadsheet_id=eq.${spreadsheet.id}` }, (payload) => {
          if (payload.eventType !== "UPDATE") {
            refreshTabs(); // a sheet was added (deletions are caught by the save and the periodic refresh)
            return;
          }
          const row = payload.new as { id: string; name: string; sort_order: number; version: number };
          const known = latest.current.sheetList.find((s) => s.id === row.id);
          if (!known || known.name !== row.name || known.sortOrder !== row.sort_order) refreshTabs();
          const s = sessions.current.get(row.id);
          if (s && Number(row.version) > s.version) helpers.scheduleRefetch(s);
        })
        .on("presence", { event: "sync" }, () => {
          const names = Object.keys(joined.presenceState()).filter((name) => name !== me);
          setViewers(names.sort((a, b) => a.localeCompare(b)));
        })
        .subscribe((state) => {
          if (cancelled) return;
          if (state === "SUBSCRIBED") {
            if (poll) {
              clearInterval(poll);
              poll = null;
            }
            void joined.track({ name: me });
            catchUp();
            refreshTabs();
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            startPolling();
          }
        });
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) {
        const removal = supabase.removeChannel(channel).finally(() => {
          if (leaving.get(topic) === removal) leaving.delete(topic);
        });
        leaving.set(topic, removal);
      }
    };
  }, [demo, spreadsheet.id, me, helpers]);

  async function addFirstSheet() {
    setAddingSheet(true);
    const formData = new FormData();
    formData.set("workbookId", spreadsheet.id);
    try {
      const result = await createSheet(formData);
      if (result.error) setNotice(result.error);
      else if (result.id) setPendingSelectId(result.id);
    } catch {
      setNotice("Couldn't add a sheet. Please try again.");
    }
    setAddingSheet(false);
  }

  const activeSheet = sheetList.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span role="status" className="inline-flex items-center gap-1.5">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          ) : status === "error" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
              <CircleAlert className="h-3.5 w-3.5" /> Not saved yet
            </span>
          ) : (
            "All changes saved"
          )}
        </span>
        {activeSheet?.updatedBy && <span>Last edited by {activeSheet.updatedBy}</span>}
        {demo ? (
          <span>Demo: live updates between people need a real account.</span>
        ) : viewers.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-ring" /> Also here: {viewers.join(", ")}
          </span>
        ) : null}
      </div>

      <div className="overflow-visible rounded-xl border border-sheet-grid bg-sheet-cell shadow-sm">
        <div className="relative z-20 flex flex-wrap items-end gap-2 rounded-t-xl border-b border-sheet-grid bg-sheet-bar px-2 pt-2">
          {activeSheet ? (
            <WorkspaceSheetTabs
              workbookId={spreadsheet.id}
              sheets={tabs}
              activeId={activeSheet.id}
              onSelect={(id) => void openSheet(id)}
              onCreated={setPendingSelectId}
              onDeleted={(deletedId, fallbackId) => {
                if (deletedId === activeId && fallbackId) void openSheet(fallbackId);
              }}
              createSheet={createSheet}
              renameSheet={renameSheet}
              reorderSheets={reorderSheets}
              deleteSheet={deleteSheet}
            />
          ) : sheetList.length === 0 ? (
            <Button type="button" size="sm" className="mb-2" disabled={addingSheet} onClick={() => void addFirstSheet()}>
              <Plus className="mr-1 h-4 w-4" /> {addingSheet ? "Adding…" : "Add a sheet"}
            </Button>
          ) : null}
        </div>

        {notice && (
          <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {notice}
          </p>
        )}

        <div className="h-[calc(100vh-16rem)] min-h-[420px] rounded-b-xl">
          {content && activeId ? (
            <WorkspaceTableBlock key={activeId} content={content} onChange={onTableChange} />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading sheet…
                </>
              ) : sheetList.length === 0 ? (
                "This spreadsheet has no sheets. Add one to start."
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
