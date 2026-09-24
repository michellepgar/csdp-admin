import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isDemoMode, getDemoState } from "@/lib/demo-session";
import type { Block, BlockContent, BlockKind, Sheet, Workbook } from "@/lib/workspace";

/* Server-only read side of My Workspace. Every real-mode query is filtered
   by the caller's own name (the database's RLS enforces the same thing;
   this is belt and braces). Demo mode reads the demo visitor's own copy out
   of the demo cookies instead. */

const DEMO_OWNER = "Jane";

type WorkbookRow = { id: string; title: string; tags: string[] | null; created_at: string; updated_at: string };
type SheetRow = { id: string; workbook_id: string; name: string; sort_order: number };
type BlockRow = { id: string; sheet_id: string; kind: string; x: number; y: number; w: number; h: number; z: number; content: unknown };

const toWorkbook = (row: WorkbookRow): Workbook => ({
  id: row.id,
  title: row.title,
  tags: row.tags ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSheet = (row: SheetRow): Sheet => ({ id: row.id, workbookId: row.workbook_id, name: row.name, sortOrder: row.sort_order });

const toBlock = (row: BlockRow): Block => ({
  id: row.id,
  sheetId: row.sheet_id,
  kind: row.kind as BlockKind,
  x: row.x,
  y: row.y,
  w: row.w,
  h: row.h,
  z: row.z,
  content: row.content as BlockContent,
});

export async function loadWorkspaceContext(): Promise<{ owner: string; demo: boolean } | null> {
  if (await isDemoMode()) return { owner: DEMO_OWNER, demo: true };

  const user = await getCurrentUser();
  if (!user || !user.email) return null;

  const supabase = await createClient();
  const { data: va } = await supabase.from("vas").select("name").ilike("email", user.email).maybeSingle();
  if (!va) return null;
  return { owner: va.name as string, demo: false };
}

export async function loadWorkbooks(): Promise<Workbook[]> {
  const context = await loadWorkspaceContext();
  if (!context) return [];

  if (context.demo) {
    const workbooks = (await getDemoState()).workspace?.workbooks ?? [];
    return [...workbooks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workbooks")
    .select("id, title, tags, created_at, updated_at")
    .eq("owner", context.owner)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as WorkbookRow[]).map(toWorkbook);
}

export async function loadWorkbook(id: string): Promise<{ workbook: Workbook; sheets: Sheet[]; blocks: Block[] } | null> {
  const context = await loadWorkspaceContext();
  if (!context) return null;

  if (context.demo) {
    const workspace = (await getDemoState()).workspace ?? { workbooks: [], sheets: [], blocks: [] };
    const workbook = workspace.workbooks.find((w) => w.id === id);
    if (!workbook) return null;
    const sheets = workspace.sheets.filter((s) => s.workbookId === id).sort((a, b) => a.sortOrder - b.sortOrder);
    const sheetIds = new Set(sheets.map((s) => s.id));
    const blocks = workspace.blocks.filter((b) => sheetIds.has(b.sheetId)).sort((a, b) => a.z - b.z);
    return { workbook, sheets, blocks };
  }

  const supabase = await createClient();
  const { data: workbookRow, error: workbookError } = await supabase
    .from("workbooks")
    .select("id, title, tags, created_at, updated_at")
    .eq("id", id)
    .eq("owner", context.owner)
    .maybeSingle();
  if (workbookError) {
    // A malformed id (not a uuid) is just "not found", not a server error.
    if (workbookError.code === "22P02") return null;
    throw new Error(workbookError.message);
  }
  if (!workbookRow) return null;

  const { data: sheetRows, error: sheetError } = await supabase
    .from("sheets")
    .select("id, workbook_id, name, sort_order")
    .eq("workbook_id", id)
    .eq("owner", context.owner)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (sheetError) throw new Error(sheetError.message);
  const sheets = (sheetRows as SheetRow[]).map(toSheet);

  let blocks: Block[] = [];
  if (sheets.length > 0) {
    const { data: blockRows, error: blockError } = await supabase
      .from("blocks")
      .select("id, sheet_id, kind, x, y, w, h, z, content")
      .in("sheet_id", sheets.map((s) => s.id))
      .eq("owner", context.owner)
      .order("z", { ascending: true })
      .order("created_at", { ascending: true });
    if (blockError) throw new Error(blockError.message);
    blocks = (blockRows as BlockRow[]).map(toBlock);
  }

  return { workbook: toWorkbook(workbookRow as WorkbookRow), sheets, blocks };
}
