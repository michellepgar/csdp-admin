"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { validateBlockContent, defaultContent, defaultRect, clampRect, normalizeTags, normalizeBackground } from "@/lib/workspace";
import type { Block, BlockKind, Rect, Sheet, Workbook } from "@/lib/workspace";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type WorkspaceActionResult = { error: string | null };
type WorkspaceCreateResult = { error: string | null; id?: string };

/* Which pages to refresh after a successful action:
   - "layout": every structural change (workbook/sheet/block create,
     rename, delete, tags, order) -- the list page and the open workbook.
   - "list": only the workbook list page (touchWorkbook).
   - "none": high-frequency saves (block content/rect) -- see the comment
     on updateBlockContent. */
type RevalidateScope = "layout" | "list" | "none";

/* Thrown errors inside a Server Action get redacted in production, so
   every action here returns {error} instead (same fix as
   app/(app)/general-tasks/actions.ts). The operation may itself return a
   {error} (a rule refusal) or an {id} (a create). */
async function runResultAction(
  operation: () => Promise<{ error?: string; id?: string } | void>,
  revalidate: RevalidateScope = "layout",
): Promise<WorkspaceCreateResult> {
  try {
    const outcome = await operation();
    if (outcome && outcome.error) return { error: outcome.error };
    if (revalidate === "layout") revalidatePath("/my-workspace", "layout");
    else if (revalidate === "list") revalidatePath("/my-workspace");
    return outcome && outcome.id ? { error: null, id: outcome.id } : { error: null };
  } catch (error) {
    console.error("Workspace action failed", error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }
}

const BLOCK_KINDS: BlockKind[] = ["table", "note", "reminder"];
const MAX_Z = 1_000_000;
const MAX_REORDER_IDS = 100;
const now = () => new Date().toISOString();
const clampZ = (z: number) => Math.min(MAX_Z, Math.max(0, Math.round(z)));

/* A form entry can also be a File; only a real string counts. */
function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/* Empty/missing values must read as "not a number" (Number("") is 0). */
function readNumber(formData: FormData, key: string): number {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return NaN;
  return Number(raw);
}

function emptyWorkspace() {
  return { workbooks: [] as Workbook[], sheets: [] as Sheet[], blocks: [] as Block[] };
}

function parseJson(text: FormDataEntryValue | null): unknown {
  if (typeof text !== "string") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function createWorkbook(formData: FormData): Promise<WorkspaceCreateResult> {
  const title = (str(formData.get("title")).trim() || "Untitled workbook").slice(0, 80);
  const workbookId = crypto.randomUUID();
  const sheetId = crypto.randomUUID();

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const workspace = (state.workspace ??= emptyWorkspace());
        const stamp = now();
        workspace.workbooks.push({ id: workbookId, title, tags: [], createdAt: stamp, updatedAt: stamp });
        workspace.sheets.push({ id: sheetId, workbookId, name: "Sheet 1", sortOrder: 0 });
      });
      return { id: workbookId };
    }

    const { supabase, me } = await requireTeamMember();
    const { error: workbookError } = await supabase.from("workbooks").insert({ id: workbookId, owner: me.name, title, tags: [] });
    orThrow(workbookError);
    const { error: sheetError } = await supabase.from("sheets").insert({ id: sheetId, workbook_id: workbookId, owner: me.name, name: "Sheet 1", sort_order: 0 });
    if (sheetError) {
      // Don't leave a workbook with no sheets behind.
      await supabase.from("workbooks").delete().eq("id", workbookId).eq("owner", me.name);
      throw new Error(sheetError.message);
    }
    return { id: workbookId };
  });
}

export async function renameWorkbook(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const title = str(formData.get("title")).trim().slice(0, 80);
  if (!title) return { error: "Enter a title." };

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const workbook = state.workspace?.workbooks.find((w) => w.id === id);
        if (workbook) {
          workbook.title = title;
          workbook.updatedAt = now();
        }
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("workbooks").update({ title, updated_at: now() }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}

export async function setWorkbookTags(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const cannotSave = "Those tags couldn't be saved.";
  const readTags = (): string[] | null => {
    const parsed = parseJson(formData.get("tags"));
    return Array.isArray(parsed) ? normalizeTags(parsed.filter((t): t is string => typeof t === "string")) : null;
  };

  return runResultAction(async () => {
    if (await isDemoMode()) {
      const tags = readTags();
      if (!tags) return { error: cannotSave };
      await demoMutate((state) => {
        const workbook = state.workspace?.workbooks.find((w) => w.id === id);
        if (workbook) {
          workbook.tags = tags;
          workbook.updatedAt = now();
        }
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const tags = readTags();
    if (!tags) return { error: cannotSave };
    const { error } = await supabase.from("workbooks").update({ tags, updated_at: now() }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}

/* The canvas keeps the chosen background in its own state, so nothing needs
   refreshing afterwards. */
export async function setWorkbookBackground(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const { bgColor, bgStyle } = normalizeBackground(str(formData.get("color")), str(formData.get("style")));

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const workbook = state.workspace?.workbooks.find((w) => w.id === id);
        if (workbook) {
          workbook.bgColor = bgColor;
          workbook.bgStyle = bgStyle;
        }
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("workbooks").update({ bg_color: bgColor || null, bg_style: bgStyle }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  }, "none");
}

export async function touchWorkbook(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));

  /* Only the list page (sorted by last opened) needs refreshing -- not
     the open workbook, whose canvas holds newer local state. */
  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const workbook = state.workspace?.workbooks.find((w) => w.id === id);
        if (workbook) workbook.updatedAt = now();
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("workbooks").update({ updated_at: now() }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  }, "list");
}

export async function deleteWorkbook(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const workspace = state.workspace;
        if (!workspace) return;
        const sheetIds = new Set(workspace.sheets.filter((s) => s.workbookId === id).map((s) => s.id));
        workspace.blocks = workspace.blocks.filter((b) => !sheetIds.has(b.sheetId));
        workspace.sheets = workspace.sheets.filter((s) => s.workbookId !== id);
        workspace.workbooks = workspace.workbooks.filter((w) => w.id !== id);
      });
      return;
    }
    // Sheets and blocks cascade in the database.
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("workbooks").delete().eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}

export async function createSheet(formData: FormData): Promise<WorkspaceCreateResult> {
  const workbookId = str(formData.get("workbookId"));
  const sheetId = crypto.randomUUID();

  return runResultAction(async () => {
    if (await isDemoMode()) {
      let missing = false;
      await demoMutate((state) => {
        const workspace = (state.workspace ??= emptyWorkspace());
        if (!workspace.workbooks.some((w) => w.id === workbookId)) {
          missing = true;
          return;
        }
        const existing = workspace.sheets.filter((s) => s.workbookId === workbookId);
        const maxOrder = existing.reduce((max, s) => Math.max(max, s.sortOrder), -1);
        workspace.sheets.push({ id: sheetId, workbookId, name: `Sheet ${existing.length + 1}`, sortOrder: maxOrder + 1 });
      });
      if (missing) return { error: "That workbook no longer exists." };
      return { id: sheetId };
    }

    const { supabase, me } = await requireTeamMember();
    const { data: workbook, error: workbookError } = await supabase.from("workbooks").select("id").eq("id", workbookId).eq("owner", me.name).maybeSingle();
    orThrow(workbookError);
    if (!workbook) return { error: "That workbook no longer exists." };

    const { data: existing, error: existingError } = await supabase.from("sheets").select("sort_order").eq("workbook_id", workbookId).eq("owner", me.name);
    orThrow(existingError);
    const rows = (existing ?? []) as { sort_order: number }[];
    const maxOrder = rows.reduce((max, s) => Math.max(max, s.sort_order), -1);

    const { error } = await supabase.from("sheets").insert({ id: sheetId, workbook_id: workbookId, owner: me.name, name: `Sheet ${rows.length + 1}`, sort_order: maxOrder + 1 });
    orThrow(error);
    return { id: sheetId };
  });
}

export async function renameSheet(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const name = str(formData.get("name")).trim().slice(0, 40);
  if (!name) return { error: "Enter a name." };

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const sheet = state.workspace?.sheets.find((s) => s.id === id);
        if (sheet) sheet.name = name;
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("sheets").update({ name }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}

export async function reorderSheets(formData: FormData): Promise<WorkspaceActionResult> {
  const workbookId = str(formData.get("workbookId"));
  const cannotSave = "That order couldn't be saved.";
  /* Deduplicated (first occurrence wins) and capped, before any update. */
  const readIds = (): string[] | null => {
    const parsed = parseJson(formData.get("orderedIds"));
    if (!Array.isArray(parsed)) return null;
    return [...new Set(parsed.filter((v): v is string => typeof v === "string"))].slice(0, MAX_REORDER_IDS);
  };

  return runResultAction(async () => {
    if (await isDemoMode()) {
      const orderedIds = readIds();
      if (!orderedIds) return { error: cannotSave };
      await demoMutate((state) => {
        const sheets = (state.workspace?.sheets ?? []).filter((s) => s.workbookId === workbookId);
        const known = new Set(sheets.map((s) => s.id));
        orderedIds.filter((sid) => known.has(sid)).forEach((sid, index) => {
          const sheet = sheets.find((s) => s.id === sid);
          if (sheet) sheet.sortOrder = index;
        });
      });
      return;
    }

    const { supabase, me } = await requireTeamMember();
    const orderedIds = readIds();
    if (!orderedIds) return { error: cannotSave };
    const { data, error: selectError } = await supabase.from("sheets").select("id").eq("workbook_id", workbookId).eq("owner", me.name);
    orThrow(selectError);
    const known = new Set(((data ?? []) as { id: string }[]).map((s) => s.id));
    const valid = orderedIds.filter((sid) => known.has(sid));
    for (const [index, sid] of valid.entries()) {
      const { error } = await supabase.from("sheets").update({ sort_order: index }).eq("id", sid).eq("workbook_id", workbookId).eq("owner", me.name);
      orThrow(error);
    }
  });
}

export async function deleteSheet(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const lastSheetError = "A workbook needs at least one sheet.";

  return runResultAction(async () => {
    if (await isDemoMode()) {
      let refused = false;
      await demoMutate((state) => {
        const workspace = state.workspace;
        const sheet = workspace?.sheets.find((s) => s.id === id);
        if (!workspace || !sheet) return;
        if (workspace.sheets.filter((s) => s.workbookId === sheet.workbookId).length <= 1) {
          refused = true;
          return;
        }
        workspace.blocks = workspace.blocks.filter((b) => b.sheetId !== id);
        workspace.sheets = workspace.sheets.filter((s) => s.id !== id);
      });
      if (refused) return { error: lastSheetError };
      return;
    }

    const { supabase, me } = await requireTeamMember();
    const { data: sheet, error: sheetError } = await supabase.from("sheets").select("id, workbook_id").eq("id", id).eq("owner", me.name).maybeSingle();
    orThrow(sheetError);
    if (!sheet) return;
    const { data: siblings, error: siblingsError } = await supabase.from("sheets").select("id").eq("workbook_id", sheet.workbook_id).eq("owner", me.name);
    orThrow(siblingsError);
    if ((siblings ?? []).length <= 1) return { error: lastSheetError };

    // Blocks cascade in the database.
    const { error } = await supabase.from("sheets").delete().eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}

export async function createBlock(formData: FormData): Promise<WorkspaceCreateResult> {
  const sheetId = str(formData.get("sheetId"));
  const kind = str(formData.get("kind")) as BlockKind;
  if (!BLOCK_KINDS.includes(kind)) return { error: "Unknown block type." };
  const x = readNumber(formData, "x");
  const y = readNumber(formData, "y");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Invalid position." };

  const blockId = crypto.randomUUID();
  // A table pasted onto the sheet arrives with its content and a size to fit it.
  const w = readNumber(formData, "w");
  const h = readNumber(formData, "h");
  const base = defaultRect(kind, x, y);
  const rect = clampRect({ ...base, w: Number.isFinite(w) ? w : base.w, h: Number.isFinite(h) ? h : base.h }, kind);
  let content = defaultContent(kind);
  if (formData.has("content")) {
    const pasted = validateBlockContent(kind, parseJson(formData.get("content")), sanitizeNoteHtml);
    if (!pasted) return { error: "That table is too big or couldn't be read." };
    content = pasted;
  }

  return runResultAction(async () => {
    if (await isDemoMode()) {
      let missing = false;
      await demoMutate((state) => {
        const workspace = (state.workspace ??= emptyWorkspace());
        if (!workspace.sheets.some((s) => s.id === sheetId)) {
          missing = true;
          return;
        }
        const maxZ = workspace.blocks.filter((b) => b.sheetId === sheetId).reduce((max, b) => Math.max(max, b.z), -1);
        workspace.blocks.push({ id: blockId, sheetId, kind, ...rect, z: clampZ(maxZ + 1), content });
      });
      if (missing) return { error: "That sheet no longer exists." };
      return { id: blockId };
    }

    const { supabase, me } = await requireTeamMember();
    const { data: sheet, error: sheetError } = await supabase.from("sheets").select("id").eq("id", sheetId).eq("owner", me.name).maybeSingle();
    orThrow(sheetError);
    if (!sheet) return { error: "That sheet no longer exists." };

    const { data: top, error: topError } = await supabase.from("blocks").select("z").eq("sheet_id", sheetId).eq("owner", me.name).order("z", { ascending: false }).limit(1).maybeSingle();
    orThrow(topError);
    const nextZ = top ? clampZ((top.z as number) + 1) : 0;

    const { error } = await supabase.from("blocks").insert({ id: blockId, sheet_id: sheetId, owner: me.name, kind, ...rect, z: nextZ, content });
    orThrow(error);
    return { id: blockId };
  });
}

/* Deliberately does NOT revalidate: the canvas keeps its own local copy of
   every block and re-syncs it whenever server props change, so refreshing
   after each debounced save could overwrite newer local edits with an
   older server copy. */
export async function updateBlockContent(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const cannotSave = "That content couldn't be saved.";

  return runResultAction(async () => {
    if (await isDemoMode()) {
      const parsed = parseJson(formData.get("content"));
      if (parsed === undefined) return { error: cannotSave };
      let failed = false;
      await demoMutate((state) => {
        const block = state.workspace?.blocks.find((b) => b.id === id);
        if (!block) return;
        const content = validateBlockContent(block.kind, parsed, (html) => sanitizeNoteHtml(html));
        if (!content) {
          failed = true;
          return;
        }
        block.content = content;
      });
      if (failed) return { error: cannotSave };
      return;
    }

    // Authenticate BEFORE parsing the (potentially multi-MB) payload.
    const { supabase, me } = await requireTeamMember();
    const parsed = parseJson(formData.get("content"));
    if (parsed === undefined) return { error: cannotSave };
    // The kind always comes from the stored row, never from the client.
    const { data: block, error: blockError } = await supabase.from("blocks").select("kind").eq("id", id).eq("owner", me.name).maybeSingle();
    orThrow(blockError);
    if (!block) return;
    const content = validateBlockContent(block.kind as BlockKind, parsed, (html) => sanitizeNoteHtml(html));
    if (!content) return { error: cannotSave };

    const { error } = await supabase.from("blocks").update({ content, updated_at: now() }).eq("id", id).eq("owner", me.name);
    orThrow(error);
  }, "none");
}

/* Deliberately does NOT revalidate -- same reason as updateBlockContent. */
export async function updateBlockRect(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));
  const raw: Rect = { x: readNumber(formData, "x"), y: readNumber(formData, "y"), w: readNumber(formData, "w"), h: readNumber(formData, "h") };
  const hasZ = str(formData.get("z")).trim() !== "";
  const z = hasZ ? readNumber(formData, "z") : undefined;
  if (![raw.x, raw.y, raw.w, raw.h].every(Number.isFinite) || (z !== undefined && !Number.isFinite(z))) return { error: "Invalid position." };

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        const block = state.workspace?.blocks.find((b) => b.id === id);
        if (!block) return;
        Object.assign(block, clampRect(raw, block.kind));
        if (z !== undefined) block.z = clampZ(z);
      });
      return;
    }

    const { supabase, me } = await requireTeamMember();
    const { data: block, error: blockError } = await supabase.from("blocks").select("kind").eq("id", id).eq("owner", me.name).maybeSingle();
    orThrow(blockError);
    if (!block) return;
    const patch: Record<string, number | string> = { ...clampRect(raw, block.kind as BlockKind), updated_at: now() };
    if (z !== undefined) patch.z = clampZ(z);

    const { error } = await supabase.from("blocks").update(patch).eq("id", id).eq("owner", me.name);
    orThrow(error);
  }, "none");
}

export async function deleteBlock(formData: FormData): Promise<WorkspaceActionResult> {
  const id = str(formData.get("id"));

  return runResultAction(async () => {
    if (await isDemoMode()) {
      await demoMutate((state) => {
        if (state.workspace) state.workspace.blocks = state.workspace.blocks.filter((b) => b.id !== id);
      });
      return;
    }
    const { supabase, me } = await requireTeamMember();
    const { error } = await supabase.from("blocks").delete().eq("id", id).eq("owner", me.name);
    orThrow(error);
  });
}
