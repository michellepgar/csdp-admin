"use client";

import { useEffect, useState } from "react";
import { Download, FileText, GripVertical, Lightbulb, Hammer, CheckCircle2, Video, type LucideIcon } from "lucide-react";
import { getSuggestionAttachmentUrls, getSuggestionDownloadUrl } from "@/app/(app)/suggestions/actions";
import { ImageLightbox } from "@/components/image-lightbox";
import { formatSuggestionFileSize, isPreviewableSuggestionImage, isVideoFile } from "@/lib/suggestions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import { cn } from "@/lib/utils";
import { canDeleteSuggestion, vaColorByName, type Suggestion, type SuggestionAttachment, type Va } from "@/lib/app-state";

const STATUSES = ["Requested", "Working On It", "Added"] as const;
type Status = (typeof STATUSES)[number];

// What each stage is called on screen. The saved value for the last stage is
// still "Added" (nothing in the database changes); it is shown as "Deployed".
const STATUS_LABEL: Record<Status, string> = { Requested: "Requested", "Working On It": "Working On It", Added: "Deployed" };

/* Each column gets its own color identity: header band, count pill and
   the top edge of every card in it, so a card reads as "in this stage"
   at a glance. Spelled out as full class names so Tailwind's scanner
   picks them up. */
const COLUMN: Record<Status, { icon: LucideIcon; band: string; pill: string; card: string; drop: string; hint: string }> = {
  Requested: {
    icon: Lightbulb,
    band: "bg-sky-600 text-white",
    pill: "bg-white/25 text-white",
    card: "border-t-sky-500",
    drop: "ring-2 ring-sky-500/60 bg-sky-500/5",
    hint: "New ideas land here.",
  },
  "Working On It": {
    icon: Hammer,
    band: "bg-amber-500 text-white",
    pill: "bg-white/25 text-white",
    card: "border-t-amber-500",
    drop: "ring-2 ring-amber-500/60 bg-amber-500/5",
    hint: "Being built right now.",
  },
  Added: {
    icon: CheckCircle2,
    band: "bg-emerald-600 text-white",
    pill: "bg-white/25 text-white",
    card: "border-t-emerald-500",
    drop: "ring-2 ring-emerald-500/60 bg-emerald-500/5",
    hint: "Live in the tracker.",
  },
};

/* timeZone pinned to Michelle's own working timezone for the same
   reason as components/issues-list.tsx's fmtDate -- SSR runs in UTC,
   hydration runs in the viewer's own timezone, and letting the two
   disagree causes an intermittent React hydration mismatch. */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
}

/* The long description on a card: a few lines, then "Show more". */
function SuggestionDetails({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split("\n").length > 4;
  return (
    <div>
      <p className={cn("whitespace-pre-wrap break-words text-sm text-muted-foreground", !open && long && "line-clamp-4")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-xs font-medium text-ring hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/* The screenshots and files on a card: pictures as thumbnails (click to
   enlarge), everything else as a small file card with a download button. */
function SuggestionFiles({ attachments }: { attachments: SuggestionAttachment[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoomed, setZoomed] = useState<SuggestionAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wanted = attachments.filter((a) => isPreviewableSuggestionImage(a.type)).map((a) => a.path);
    if (wanted.length === 0) return;
    let cancelled = false;
    void getSuggestionAttachmentUrls(wanted).then((found) => {
      if (!cancelled) setUrls((current) => ({ ...current, ...found }));
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  async function download(attachment: SuggestionAttachment) {
    setError(null);
    const result = await getSuggestionDownloadUrl(attachment.path, attachment.name);
    if (!result.url) {
      setError(result.error ?? "Couldn't download that file.");
      return;
    }
    const link = document.createElement("a");
    link.href = result.url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const images = attachments.filter((a) => isPreviewableSuggestionImage(a.type));
  const files = attachments.filter((a) => !isPreviewableSuggestionImage(a.type));

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((image) =>
            urls[image.path] ? (
              <button key={image.id} type="button" onClick={() => setZoomed(image)} title={image.name} className="overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed picture link */}
                <img src={urls[image.path]} alt={image.name} className="h-24 w-auto max-w-full object-cover" />
              </button>
            ) : (
              <span key={image.id} className="flex h-24 w-32 items-center justify-center rounded-lg border bg-muted/40 text-[11px] text-muted-foreground">{image.name}</span>
            ),
          )}
        </div>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5 text-xs">
              {isVideoFile(file.type) ? <Video className="h-4 w-4 flex-none text-ring" /> : <FileText className="h-4 w-4 flex-none text-ring" />}
              <span className="min-w-0 flex-1 truncate font-medium" title={file.name}>{file.name}</span>
              <span className="flex-none text-muted-foreground">{formatSuggestionFileSize(file.size)}</span>
              <button type="button" onClick={() => void download(file)} aria-label={`Download ${file.name}`} className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-ring hover:bg-ring/10">
                <Download className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      {zoomed && urls[zoomed.path] && <ImageLightbox src={urls[zoomed.path]} onClose={() => setZoomed(null)} onDownload={() => void download(zoomed)} />}
    </div>
  );
}

/* Suggestions as a kanban board: one column per stage. Michelle drags a
   card to another column (or uses the small stage dropdown, which also
   works on a phone) to move it. Only the person who posted a suggestion,
   and Michelle, can delete it. */
export function SuggestionsList({
  suggestions,
  currentUserName,
  isMichelle,
  vas,
  setSuggestionStatus,
  removeSuggestion,
}: {
  suggestions: Suggestion[];
  currentUserName: string;
  isMichelle: boolean;
  vas: Va[];
  setSuggestionStatus: (formData: FormData) => void;
  removeSuggestion: (formData: FormData) => void;
}) {
  const [sortField, setSortField] = useState<"date" | "author">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<Status | null>(null);
  // A dropped card moves at once, before the server round trip finishes.
  const [pending, setPending] = useState<Record<string, Status>>({});

  const statusOf = (s: Suggestion): Status => pending[s.id] ?? s.status;

  const sorted = [...suggestions].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "author") return a.author.localeCompare(b.author) * dir;
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
  });

  function moveTo(id: string, status: Status) {
    const current = suggestions.find((s) => s.id === id);
    if (!current || statusOf(current) === status) return;
    setPending((p) => ({ ...p, [id]: status }));
    const data = new FormData();
    data.set("id", id);
    data.set("status", status);
    setSuggestionStatus(data);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          name="sortField"
          value={sortField}
          onChange={(v) => setSortField(v as "date" | "author")}
          options={[{ value: "date", label: "Sort by date" }, { value: "author", label: "Sort by author" }]}
          className="rounded-md border px-2 py-1 text-left text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "↑ Ascending" : "↓ Descending"}
        </Button>
        {isMichelle && <span className="text-xs text-muted-foreground">Drag a card to another column to change its stage.</span>}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-3">
        {STATUSES.map((status) => {
          const list = sorted.filter((s) => statusOf(s) === status);
          const col = COLUMN[status];
          const Icon = col.icon;
          const isOver = overStatus === status && draggedId !== null;
          return (
            <section
              key={status}
              onDragOver={isMichelle ? (event) => { event.preventDefault(); setOverStatus(status); } : undefined}
              onDragLeave={isMichelle ? () => setOverStatus((current) => (current === status ? null : current)) : undefined}
              onDrop={isMichelle ? (event) => { event.preventDefault(); if (draggedId) moveTo(draggedId, status); setDraggedId(null); setOverStatus(null); } : undefined}
              className={`min-w-0 overflow-hidden rounded-xl border bg-muted/30 shadow-sm transition ${isOver ? col.drop : ""}`}
            >
              <div className={`flex items-center gap-2 px-3 py-2.5 ${col.band}`}>
                <Icon className="h-4 w-4" />
                <h2 className="bg-transparent px-0 py-0 text-sm font-semibold text-inherit">{STATUS_LABEL[status]}</h2>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${col.pill}`}>{list.length}</span>
              </div>
              <div className="min-h-24 space-y-2.5 p-2.5">
                {list.length === 0 && (
                  <div className="flex flex-col items-center gap-0.5 rounded-lg border border-dashed px-3 py-6 text-center">
                    <Icon className="h-5 w-5 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Nothing here yet</p>
                    <p className="text-xs text-muted-foreground">{col.hint}</p>
                  </div>
                )}
                {list.map((s) => {
                  const color = vaColorByName(vas, s.author);
                  return (
                    <div
                      key={s.id}
                      draggable={isMichelle}
                      onDragStart={isMichelle ? () => setDraggedId(s.id) : undefined}
                      onDragEnd={isMichelle ? () => { setDraggedId(null); setOverStatus(null); } : undefined}
                      className={`space-y-2 rounded-lg border border-t-4 bg-card p-3 shadow-sm transition hover:shadow-md ${col.card} ${isMichelle ? "cursor-grab active:cursor-grabbing" : ""} ${draggedId === s.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start gap-1.5">
                        {isMichelle && <GripVertical className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground/50" aria-hidden />}
                        <p className="min-w-0 flex-1 break-words text-sm font-medium">{s.text}</p>
                        {canDeleteSuggestion(s, currentUserName) && (
                          <form action={removeSuggestion} className="flex-none">
                            <input type="hidden" name="id" value={s.id} />
                            <ConfirmDeleteButton confirmMessage="Remove this suggestion?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                          </form>
                        )}
                      </div>
                      {s.details && <SuggestionDetails text={s.details} />}
                      {s.attachments && s.attachments.length > 0 && <SuggestionFiles attachments={s.attachments} />}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: color || "#64748b" }} aria-hidden>
                            {s.author.charAt(0).toUpperCase()}
                          </span>
                          {s.author} · {formatDate(s.createdAt)}
                        </p>
                        {isMichelle && (
                          <AutoSubmitDropdown
                            action={setSuggestionStatus}
                            hiddenFields={{ id: s.id }}
                            name="status"
                            value={statusOf(s)}
                            options={STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st] }))}
                            className="rounded-md border px-2 py-1 text-left text-xs"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
