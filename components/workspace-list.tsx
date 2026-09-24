"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, Plus, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KebabMenu } from "@/components/kebab-menu";
import { normalizeTags, tagColor } from "@/lib/workspace";
import type { TagColor, Workbook } from "@/lib/workspace";

type ActionResult = { error: string | null; id?: string };
type WorkbookAction = (formData: FormData) => Promise<ActionResult>;

/* Every class name is written out in full so Tailwind can see it. */
const TAG_CLASSES: Record<TagColor, string> = {
  teal: "bg-teal-100 text-teal-800 ring-teal-300/60 dark:bg-teal-900/40 dark:text-teal-200 dark:ring-teal-700/50",
  violet: "bg-violet-100 text-violet-800 ring-violet-300/60 dark:bg-violet-900/40 dark:text-violet-200 dark:ring-violet-700/50",
  amber: "bg-amber-100 text-amber-800 ring-amber-300/60 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700/50",
  rose: "bg-rose-100 text-rose-800 ring-rose-300/60 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-700/50",
  sky: "bg-sky-100 text-sky-800 ring-sky-300/60 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-700/50",
  green: "bg-green-100 text-green-800 ring-green-300/60 dark:bg-green-900/40 dark:text-green-200 dark:ring-green-700/50",
  orange: "bg-orange-100 text-orange-800 ring-orange-300/60 dark:bg-orange-900/40 dark:text-orange-200 dark:ring-orange-700/50",
  slate: "bg-slate-200 text-slate-800 ring-slate-300/70 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-500/50",
};

/* An explicit timeZone keeps the server render and the browser's hydration
   in agreement (same reasoning as fmtDate in components/issues-list.tsx). */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
}

function TagPill({ tag, active, onClick }: { tag: string; active?: boolean; onClick?: () => void }) {
  const classes = `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TAG_CLASSES[tagColor(tag)]}`;
  if (!onClick) return <span className={classes}>{tag}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${classes} transition-shadow hover:shadow-md ${active ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-80 hover:opacity-100"}`}
    >
      {tag}
    </button>
  );
}

function WorkbookCard({
  workbook,
  renameWorkbook,
  setWorkbookTags,
  deleteWorkbook,
  onError,
}: {
  workbook: Workbook;
  renameWorkbook: WorkbookAction;
  setWorkbookTags: WorkbookAction;
  deleteWorkbook: WorkbookAction;
  onError: (message: string | null) => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "tags">("view");
  const [titleDraft, setTitleDraft] = useState(workbook.title);
  const [tagsDraft, setTagsDraft] = useState(workbook.tags.join(", "));
  const [pending, startTransition] = useTransition();

  function run(action: WorkbookAction, formData: FormData, after?: () => void) {
    startTransition(async () => {
      const result = await action(formData);
      if (result.error) onError(result.error);
      else {
        onError(null);
        after?.();
      }
    });
  }

  function saveTitle() {
    const title = titleDraft.trim();
    if (!title) return;
    const fd = new FormData();
    fd.set("id", workbook.id);
    fd.set("title", title);
    run(renameWorkbook, fd, () => setMode("view"));
  }

  function saveTags() {
    const tags = normalizeTags(tagsDraft.split(","));
    const fd = new FormData();
    fd.set("id", workbook.id);
    fd.set("tags", JSON.stringify(tags));
    run(setWorkbookTags, fd, () => setMode("view"));
  }

  function remove() {
    if (!window.confirm(`Delete "${workbook.title}" and everything in it? This can't be undone.`)) return;
    const fd = new FormData();
    fd.set("id", workbook.id);
    run(deleteWorkbook, fd);
  }

  return (
    <li className={`group relative overflow-hidden rounded-xl border border-ring/20 bg-record-background shadow-sm transition-all hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-lg ${pending ? "opacity-60" : ""}`}>
      <div className="h-1.5 bg-gradient-to-r from-ring/70 via-ring/40 to-transparent" aria-hidden />
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <Link
          href={`/my-workspace/${workbook.id}`}
          aria-label={`Open ${workbook.title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ring/15 text-ring transition-colors group-hover:bg-ring/25"
        >
          <BookOpen className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1">
          {mode === "rename" ? (
            <form onSubmit={(e) => { e.preventDefault(); saveTitle(); }} className="flex flex-wrap items-center gap-2">
              <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} maxLength={80} autoFocus aria-label="Workbook title" className="h-8 min-w-0 flex-1" />
              <Button type="submit" size="sm" disabled={pending || !titleDraft.trim()}>Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
            </form>
          ) : (
            <Link href={`/my-workspace/${workbook.id}`} className="block break-words text-base font-semibold leading-tight hover:text-ring hover:underline">
              {workbook.title}
            </Link>
          )}

          {mode === "tags" ? (
            <form onSubmit={(e) => { e.preventDefault(); saveTags(); }} className="mt-2 flex flex-wrap items-center gap-2">
              <Input value={tagsDraft} onChange={(e) => setTagsDraft(e.target.value)} placeholder="Tags, separated by commas" autoFocus aria-label="Tags" className="h-8 min-w-0 flex-1" />
              <Button type="submit" size="sm" disabled={pending}>Save</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
            </form>
          ) : (
            workbook.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {workbook.tags.map((tag) => <TagPill key={tag} tag={tag} />)}
              </div>
            )
          )}

          <p className="mt-2 text-xs text-muted-foreground">Opened {fmtDate(workbook.updatedAt)}</p>
        </div>

        <KebabMenu
          ariaLabel={`Actions for ${workbook.title}`}
          items={[
            { label: "Rename", onClick: () => { setTitleDraft(workbook.title); setMode("rename"); } },
            { label: "Edit tags", onClick: () => { setTagsDraft(workbook.tags.join(", ")); setMode("tags"); } },
            { label: "Delete", destructive: true, onClick: remove },
          ]}
        />
      </div>
    </li>
  );
}

export function WorkspaceList({
  workbooks,
  createWorkbook,
  renameWorkbook,
  setWorkbookTags,
  deleteWorkbook,
}: {
  workbooks: Workbook[];
  createWorkbook: WorkbookAction;
  renameWorkbook: WorkbookAction;
  setWorkbookTags: WorkbookAction;
  deleteWorkbook: WorkbookAction;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"opened" | "name">("opened");
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const allTags = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const w of workbooks) for (const t of w.tags) if (!byKey.has(t.toLowerCase())) byKey.set(t.toLowerCase(), t);
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [workbooks]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = workbooks.filter((w) => {
      if (needle && !w.title.toLowerCase().includes(needle)) return false;
      if (activeTag && !w.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) return false;
      return true;
    });
    return filtered.sort((a, b) => (sort === "name" ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)));
  }, [workbooks, search, activeTag, sort]);

  function create() {
    startCreate(async () => {
      const fd = new FormData();
      fd.set("title", "Untitled workbook");
      const result = await createWorkbook(fd);
      if (result.error || !result.id) {
        setError(result.error ?? "Couldn't create the workbook.");
        return;
      }
      setError(null);
      router.push(`/my-workspace/${result.id}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ring/20 bg-header-background p-3 shadow-sm">
        <Button type="button" onClick={create} disabled={creating}>
          <Plus className="mr-1 h-4 w-4" />
          {creating ? "Creating…" : "New workbook"}
        </Button>
        <div className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workbooks…" aria-label="Search workbooks" className="bg-background pl-8" />
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-white">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "opened" | "name")}
            className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
          >
            <option value="opened">Last opened</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-4 w-4 text-muted-foreground" aria-hidden />
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${activeTag === null ? "bg-ring text-white ring-ring" : "bg-muted text-muted-foreground ring-border hover:bg-ring/10"}`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <TagPill key={tag} tag={tag} active={activeTag?.toLowerCase() === tag.toLowerCase()} onClick={() => setActiveTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)} />
          ))}
        </div>
      )}

      {workbooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ring/40 bg-record-background px-4 py-12 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ring/15 text-ring"><BookOpen className="h-6 w-6" /></span>
          <p className="text-sm text-muted-foreground">No workbooks yet. Create your first one to get started.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ring/40 bg-record-background px-4 py-8 text-center text-sm text-muted-foreground">No workbooks match your search.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((workbook) => (
            <WorkbookCard
              key={workbook.id}
              workbook={workbook}
              renameWorkbook={renameWorkbook}
              setWorkbookTags={setWorkbookTags}
              deleteWorkbook={deleteWorkbook}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
