"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { loadSheetContent } from "@/lib/spreadsheet-data";
import { applySheetOps, readSheetOps } from "@/lib/sheet-ops";
import { blankGrid, readGrid } from "@/lib/spreadsheets";
import type { SheetContent, SpreadsheetData } from "@/lib/spreadsheets";
import { normalizeTags, validateBlockContent } from "@/lib/workspace";
import type { TableContent } from "@/lib/workspace";

/* Shared Spreadsheets: every team member may do everything here (the
   database's row-level security allows any team member, see
   supabase/phase76_shared_spreadsheets.sql). Thrown errors are redacted in
   production, so every action returns {error} instead. */

type ActionResult = { error: string | null; id?: string };
type SaveResult = { error: string | null; version?: number; code?: "invalid" | "tooBig" | "gone" | "busy" | "retry" };

const MAX_REORDER_IDS = 100;
const SAVE_ATTEMPTS = 5;
const now = () => new Date().toISOString();
const str = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

function parseJson(text: FormDataEntryValue | null): unknown {
  if (typeof text !== "string") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const emptyData = (): SpreadsheetData => ({ spreadsheets: [], sheets: [], contents: {} });

async function run(operation: () => Promise<{ error?: string; id?: string } | void>, refresh = true): Promise<ActionResult> {
  try {
    const outcome = await operation();
    if (outcome && outcome.error) return { error: outcome.error };
    if (refresh) revalidatePath("/spreadsheets", "layout");
    return outcome && outcome.id ? { error: null, id: outcome.id } : { error: null };
  } catch (error) {
    console.error("Spreadsheet action failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }
}

export async function createSpreadsheet(formData: FormData): Promise<ActionResult> {
  const title = (str(formData.get("title")).trim() || "Untitled spreadsheet").slice(0, 80);
  const id = crypto.randomUUID();
  const sheetId = crypto.randomUUID();
  const content = blankGrid();

  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const data = (state.spreadsheets ??= emptyData());
        const stamp = now();
        data.spreadsheets.push({ id, title, tags: [], createdBy: "Jane", createdAt: stamp, updatedAt: stamp, updatedBy: "Jane" });
        data.sheets.push({ id: sheetId, spreadsheetId: id, name: "Sheet 1", sortOrder: 0, version: 0, updatedAt: stamp, updatedBy: "Jane" });
        data.contents[sheetId] = { content, version: 0 };
      });
      return { id };
    }
    const { supabase, me } = await requireTeamMember();
    orThrow((await supabase.from("spreadsheets").insert({ id, title, created_by: me.name, updated_by: me.name })).error);
    const sheet = await supabase.from("spreadsheet_sheets").insert({ id: sheetId, spreadsheet_id: id, name: "Sheet 1", sort_order: 0, updated_by: me.name });
    const body = sheet.error ? sheet : await supabase.from("spreadsheet_sheet_content").insert({ sheet_id: sheetId, content, version: 0, updated_by: me.name });
    if (body.error) {
      // Don't leave a spreadsheet without a sheet behind.
      await supabase.from("spreadsheets").delete().eq("id", id);
      throw new Error(body.error.message);
    }
    return { id };
  });
}

export async function renameSpreadsheet(formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const title = str(formData.get("title")).trim().slice(0, 80);
  if (!title) return { error: "Enter a title." };
  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const item = state.spreadsheets?.spreadsheets.find((s) => s.id === id);
        if (item) item.title = title;
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    orThrow((await supabase.from("spreadsheets").update({ title, updated_at: now(), updated_by: me.name }).eq("id", id)).error);
  });
}

export async function setSpreadsheetTags(formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const parsed = parseJson(formData.get("tags"));
  if (!Array.isArray(parsed)) return { error: "Those tags couldn't be saved." };
  const tags = normalizeTags(parsed.filter((t): t is string => typeof t === "string"));
  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const item = state.spreadsheets?.spreadsheets.find((s) => s.id === id);
        if (item) item.tags = tags;
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    orThrow((await supabase.from("spreadsheets").update({ tags, updated_at: now(), updated_by: me.name }).eq("id", id)).error);
  });
}

export async function deleteSpreadsheet(formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const data = state.spreadsheets;
        if (!data) return;
        const gone = new Set(data.sheets.filter((s) => s.spreadsheetId === id).map((s) => s.id));
        data.spreadsheets = data.spreadsheets.filter((s) => s.id !== id);
        data.sheets = data.sheets.filter((s) => !gone.has(s.id));
        for (const sheetId of gone) delete data.contents[sheetId];
      });
      return;
    }
    const { supabase } = await requireTeamMember();
    orThrow((await supabase.from("spreadsheets").delete().eq("id", id)).error);
  });
}

/* The sheet tabs are shared with My Workspace, which names the parent "workbookId". */
export async function createSpreadsheetSheet(formData: FormData): Promise<ActionResult> {
  const spreadsheetId = str(formData.get("workbookId"));
  const sheetId = crypto.randomUUID();
  const content = blankGrid();
  return run(async () => {
    if (await isDemoMode()) {
      let missing = false;
      await demoMutate((state) => {
        const data = (state.spreadsheets ??= emptyData());
        if (!data.spreadsheets.some((s) => s.id === spreadsheetId)) {
          missing = true;
          return;
        }
        const existing = data.sheets.filter((s) => s.spreadsheetId === spreadsheetId);
        const maxOrder = existing.reduce((max, s) => Math.max(max, s.sortOrder), -1);
        data.sheets.push({ id: sheetId, spreadsheetId, name: `Sheet ${existing.length + 1}`, sortOrder: maxOrder + 1, version: 0, updatedAt: now(), updatedBy: "Jane" });
        data.contents[sheetId] = { content, version: 0 };
      });
      return missing ? { error: "That spreadsheet no longer exists." } : { id: sheetId };
    }
    const { supabase, me } = await requireTeamMember();
    const { data: existing, error } = await supabase.from("spreadsheet_sheets").select("sort_order").eq("spreadsheet_id", spreadsheetId);
    orThrow(error);
    const rows = (existing ?? []) as { sort_order: number }[];
    const maxOrder = rows.reduce((max, s) => Math.max(max, s.sort_order), -1);
    const inserted = await supabase.from("spreadsheet_sheets").insert({ id: sheetId, spreadsheet_id: spreadsheetId, name: `Sheet ${rows.length + 1}`, sort_order: maxOrder + 1, updated_by: me.name });
    if (inserted.error) {
      if (inserted.error.code === "23503") return { error: "That spreadsheet no longer exists." };
      throw new Error(inserted.error.message);
    }
    const body = await supabase.from("spreadsheet_sheet_content").insert({ sheet_id: sheetId, content, version: 0, updated_by: me.name });
    if (body.error) {
      await supabase.from("spreadsheet_sheets").delete().eq("id", sheetId);
      throw new Error(body.error.message);
    }
    return { id: sheetId };
  });
}

export async function renameSpreadsheetSheet(formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const name = str(formData.get("name")).trim().slice(0, 40);
  if (!name) return { error: "Enter a name." };
  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const sheet = state.spreadsheets?.sheets.find((s) => s.id === id);
        if (sheet) sheet.name = name;
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    orThrow((await supabase.from("spreadsheet_sheets").update({ name, updated_by: me.name }).eq("id", id)).error);
  });
}

export async function reorderSpreadsheetSheets(formData: FormData): Promise<ActionResult> {
  const spreadsheetId = str(formData.get("workbookId"));
  const parsed = parseJson(formData.get("orderedIds"));
  if (!Array.isArray(parsed)) return { error: "That order couldn't be saved." };
  const orderedIds = [...new Set(parsed.filter((v): v is string => typeof v === "string"))].slice(0, MAX_REORDER_IDS);
  return run(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const sheets = (state.spreadsheets?.sheets ?? []).filter((s) => s.spreadsheetId === spreadsheetId);
        orderedIds.forEach((sid, index) => {
          const sheet = sheets.find((s) => s.id === sid);
          if (sheet) sheet.sortOrder = index;
        });
      });
      return;
    }
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.from("spreadsheet_sheets").select("id").eq("spreadsheet_id", spreadsheetId);
    orThrow(error);
    const known = new Set(((data ?? []) as { id: string }[]).map((s) => s.id));
    for (const [index, sid] of orderedIds.filter((sid) => known.has(sid)).entries()) {
      orThrow((await supabase.from("spreadsheet_sheets").update({ sort_order: index }).eq("id", sid).eq("spreadsheet_id", spreadsheetId)).error);
    }
  });
}

export async function deleteSpreadsheetSheet(formData: FormData): Promise<ActionResult> {
  const id = str(formData.get("id"));
  const lastSheet = "A spreadsheet needs at least one sheet.";
  return run(async () => {
    if (await isDemoMode()) {
      let refused = false;
      await demoMutate((state) => {
        const data = state.spreadsheets;
        const sheet = data?.sheets.find((s) => s.id === id);
        if (!data || !sheet) return;
        if (data.sheets.filter((s) => s.spreadsheetId === sheet.spreadsheetId).length <= 1) {
          refused = true;
          return;
        }
        data.sheets = data.sheets.filter((s) => s.id !== id);
        delete data.contents[id];
      });
      return refused ? { error: lastSheet } : undefined;
    }
    const { supabase } = await requireTeamMember();
    const { data: sheet, error } = await supabase.from("spreadsheet_sheets").select("spreadsheet_id").eq("id", id).maybeSingle();
    orThrow(error);
    if (!sheet) return;
    const { count, error: countError } = await supabase.from("spreadsheet_sheets").select("id", { count: "exact", head: true }).eq("spreadsheet_id", sheet.spreadsheet_id);
    orThrow(countError);
    if ((count ?? 0) <= 1) return { error: lastSheet };
    orThrow((await supabase.from("spreadsheet_sheets").delete().eq("id", id)).error);
  });
}

/** One sheet's latest grid (used when switching tabs and after someone else saves). */
export async function fetchSheetContent(sheetId: string): Promise<{ error: string | null; sheet?: SheetContent }> {
  try {
    const sheet = await loadSheetContent(typeof sheetId === "string" ? sheetId : "");
    return sheet ? { error: null, sheet } : { error: "That sheet no longer exists." };
  } catch (error) {
    console.error("Loading a sheet failed", error);
    return { error: "Couldn't load this sheet. Please try again." };
  }
}

/* Applies a batch of edits to the LATEST saved grid and returns the new
   version. If someone else saved in between, the write is refused by the
   version check and simply retried on top of their copy, so both people's
   edits are kept. Deliberately no page refresh: the editor keeps its own copy.

   `code` tells the editor what to do about a failure: "busy" and "retry" are
   worth trying again; "invalid" and "tooBig" never will be (the edits are
   dropped and the sheet reloaded); "gone" means the sheet was deleted. */
export async function saveSheetOps(formData: FormData): Promise<SaveResult> {
  const sheetId = str(formData.get("sheetId"));
  const ops = readSheetOps(parseJson(formData.get("ops")));
  if (!ops) return { error: "That change couldn't be saved, so it was undone. Please make it again.", code: "invalid" };
  const tooBig: SaveResult = { error: "This sheet has reached its size limit, so that change wasn't saved.", code: "tooBig" };
  const gone: SaveResult = { error: "This sheet was deleted by someone else.", code: "gone" };

  if (await isDemoMode()) {
    let result: SaveResult = gone;
    try {
      await demoMutate((state) => {
        const current = state.spreadsheets?.contents[sheetId];
        if (!current) return;
        const next = validateBlockContent("table", applySheetOps(readGrid(current.content), ops), sanitizeNoteHtml) as TableContent | null;
        if (!next) {
          result = tooBig;
          return;
        }
        const version = current.version + 1;
        state.spreadsheets!.contents[sheetId] = { content: next, version };
        const sheet = state.spreadsheets!.sheets.find((s) => s.id === sheetId);
        const stamp = now();
        if (sheet) Object.assign(sheet, { version, updatedAt: stamp, updatedBy: "Jane" });
        const parent = state.spreadsheets!.spreadsheets.find((s) => s.id === sheet?.spreadsheetId);
        if (parent) Object.assign(parent, { updatedAt: stamp, updatedBy: "Jane" });
        result = { error: null, version };
      });
    } catch (error) {
      // The demo's own "small limit" message.
      return { error: error instanceof Error ? error.message : tooBig.error, code: "tooBig" };
    }
    return result;
  }

  try {
    const { supabase, me } = await requireTeamMember();
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
      const { data, error } = await supabase.from("spreadsheet_sheet_content").select("content, version").eq("sheet_id", sheetId).maybeSingle();
      if (error) return { error: "Couldn't save your change. It's kept here; trying again shortly.", code: "retry" };
      if (!data) return gone;
      const version = Number(data.version);
      const next = validateBlockContent("table", applySheetOps(readGrid(data.content), ops), sanitizeNoteHtml);
      if (!next) return tooBig;
      const { data: saved, error: saveError } = await supabase
        .from("spreadsheet_sheet_content")
        .update({ content: next, version: version + 1, updated_by: me.name })
        .eq("sheet_id", sheetId)
        .eq("version", version)
        .select("version");
      if (saveError) return { error: "Couldn't save your change. It's kept here; trying again shortly.", code: "retry" };
      if (saved && saved.length > 0) return { error: null, version: version + 1 };
      // Someone saved first: go round again on top of their copy.
    }
    return { error: "This sheet is busy right now. Your change is kept here and will be saved shortly.", code: "busy" };
  } catch (error) {
    console.error("Saving a sheet failed", error);
    return { error: "Couldn't save your change. It's kept here; trying again shortly.", code: "retry" };
  }
}
