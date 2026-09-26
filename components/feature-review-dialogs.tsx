"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, ImagePlus, Pencil, Printer, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REVIEW_COLUMNS, moveCard, newReviewId, readStatus, type ReviewCard, type ReviewPicture } from "@/lib/feature-review";
import { formatDecisionDate } from "@/lib/feature-review-report";
import { teamDateIso } from "@/lib/shift";

/* Column colors, written out in full so Tailwind can see every class. */
export const TONE_CLASSES = {
  blue: { border: "border-l-sky-500", head: "bg-sky-500/15 text-sky-900 dark:text-sky-100", dot: "bg-sky-500", over: "ring-2 ring-sky-400/70 bg-sky-500/5" },
  amber: { border: "border-l-amber-500", head: "bg-amber-500/15 text-amber-900 dark:text-amber-100", dot: "bg-amber-500", over: "ring-2 ring-amber-400/70 bg-amber-500/5" },
  green: { border: "border-l-emerald-500", head: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100", dot: "bg-emerald-500", over: "ring-2 ring-emerald-400/70 bg-emerald-500/5" },
  red: { border: "border-l-rose-500", head: "bg-rose-500/15 text-rose-900 dark:text-rose-100", dot: "bg-rose-500", over: "ring-2 ring-rose-400/70 bg-rose-500/5" },
} as const;

export function toneOf(status: ReviewCard["status"]) {
  return TONE_CLASSES[REVIEW_COLUMNS.find((c) => c.status === status)?.tone ?? "blue"];
}

/* A pop-up over the page: centered on a computer, full screen on a phone. Esc closes it. */
function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl sm:border">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A picture shown full size; click anywhere to close. */
export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <button type="button" aria-label="Close picture" onClick={onClose} className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-black/85 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not a static asset */}
      <img src={src} alt={alt} className="max-h-[96vh] max-w-[96vw] rounded-md shadow-2xl" />
    </button>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/* One picture in the details: the image (click for full size), or a placeholder
   with an Upload button when its file hasn't been uploaded yet. */
function PictureFigure({ picture, url, canUpload, onOpen, onUpload }: { picture: ReviewPicture; url?: string; canUpload: boolean; onOpen: () => void; onUpload: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <figure className="space-y-1">
      {url ? (
        <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted/30" title="Click to see it full size">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not a static asset */}
          <img src={url} alt={picture.caption || picture.file} className="max-h-72 w-full object-contain" />
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          <ImageIcon className="h-6 w-6" />
          <span>
            {picture.path ? "Loading picture…" : "Picture not uploaded yet"}
            <span className="block text-xs">{picture.file}</span>
          </span>
          {!picture.path && canUpload && (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
              <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload
              </Button>
            </>
          )}
        </div>
      )}
      {picture.caption && <figcaption className="text-xs text-muted-foreground">{picture.caption}</figcaption>}
    </figure>
  );
}

/* A card's details: pictures, what / why / how, and the decision box, which
   saves as you type. */
export function CardDetails({
  card,
  urls,
  canUpload,
  onChange,
  onUpload,
  onEdit,
  onDelete,
  onPrint,
  onClose,
}: {
  card: ReviewCard;
  urls: Record<string, string>;
  canUpload: boolean;
  onChange: (card: ReviewCard) => void;
  onUpload: (pictureId: string, file: File) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<"" | "saving" | "saved">("");
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function change(next: ReviewCard) {
    onChange(next);
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    // The board saves a moment after the last change; show it then.
    timer.current = setTimeout(() => {
      setSaved("saved");
      timer.current = setTimeout(() => setSaved(""), 1800);
    }, 900);
  }

  return (
    <Modal label={card.title} onClose={onClose}>
      <div className="flex items-start gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          {card.area && <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{card.area}</span>}
          <p role="heading" aria-level={2} className="text-lg font-semibold leading-snug text-balance">{card.title}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit card" title="Edit card">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete card" title="Delete card" className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" title="Close" autoFocus>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {card.pictures.length > 0 && (
          <div className={`grid gap-3 ${card.pictures.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {card.pictures.map((p) => (
              <PictureFigure
                key={p.id}
                picture={p}
                url={p.path ? urls[p.path] : undefined}
                canUpload={canUpload}
                onOpen={() => p.path && urls[p.path] && setZoom({ src: urls[p.path], alt: p.caption || p.file })}
                onUpload={(file) => onUpload(p.id, file)}
              />
            ))}
          </div>
        )}
        {card.what && (
          <Section title="What it does">
            <p className="text-sm leading-relaxed">{card.what}</p>
          </Section>
        )}
        {card.why && (
          <Section title="Why we need it">
            <p className="text-sm leading-relaxed">{card.why}</p>
          </Section>
        )}
        {card.how.length > 0 && (
          <Section title="How to try it">
            <ol className="list-decimal space-y-0.5 pl-5 text-sm leading-relaxed">
              {card.how.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </Section>
        )}

        <section className="space-y-3 rounded-xl border-2 border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Decision</h3>
            <span role="status" className="text-xs font-medium text-status-success-foreground">
              {saved === "saving" ? "Saving…" : saved === "saved" ? "✓ Saved" : ""}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Decision</span>
              <select
                value={card.status}
                onChange={(e) => change(moveCard(card, readStatus(e.target.value) ?? "todo", teamDateIso()))}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {REVIEW_COLUMNS.map((c) => (
                  <option key={c.status} value={c.status}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Decision date</span>
              <input type="date" value={card.decisionDate} onChange={(e) => change({ ...card, decisionDate: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Client comments</span>
            <textarea
              value={card.comments}
              onChange={(e) => change({ ...card, comments: e.target.value })}
              rows={5}
              placeholder="What the client said about this feature…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">
        <Button type="button" variant="outline" onClick={onPrint}>
          <Printer className="mr-1.5 h-4 w-4" /> Print this card
        </Button>
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </div>
      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </Modal>
  );
}

type Draft = { title: string; area: string; what: string; why: string; how: string; pictures: ReviewPicture[] };

/* Add card / Edit card: the same fields as the details, plus pictures with captions. */
export function CardForm({
  card,
  areas,
  canUpload,
  upload,
  onSave,
  onCancel,
}: {
  card: ReviewCard | null;
  areas: string[];
  canUpload: boolean;
  upload: (file: File) => Promise<{ path: string } | { error: string }>;
  onSave: (card: ReviewCard) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    title: card?.title ?? "",
    area: card?.area ?? "",
    what: card?.what ?? "",
    why: card?.why ?? "",
    how: (card?.how ?? []).join("\n"),
    pictures: card?.pictures ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function addPictures(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: ReviewPicture[] = [];
    for (const file of Array.from(files)) {
      const result = await upload(file);
      if ("error" in result) {
        setError(result.error);
        continue;
      }
      added.push({ id: newReviewId(), file: file.name, caption: "", path: result.path });
    }
    setDraft((d) => ({ ...d, pictures: [...d.pictures, ...added] }));
    setBusy(false);
  }

  function save() {
    const title = draft.title.trim();
    if (!title) {
      setError("Give the card a title.");
      return;
    }
    onSave({
      id: card?.id ?? newReviewId(),
      status: card?.status ?? "todo",
      decisionDate: card?.decisionDate ?? "",
      comments: card?.comments ?? "",
      title,
      area: draft.area.trim(),
      what: draft.what.trim(),
      why: draft.why.trim(),
      how: draft.how.split("\n").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean),
      pictures: draft.pictures,
    });
  }

  const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <Modal label={card ? "Edit card" : "Add card"} onClose={onCancel}>
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <p role="heading" aria-level={2} className="flex-1 text-lg font-semibold">{card ? "Edit card" : "Add card"}</p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Close" title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Title</span>
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} required autoFocus className={field} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Area</span>
            <input value={draft.area} onChange={(e) => set({ area: e.target.value })} maxLength={60} list="feature-review-areas" placeholder="e.g. Teeth Chart" className={field} />
            <datalist id="feature-review-areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">What it does</span>
          <textarea value={draft.what} onChange={(e) => set({ what: e.target.value })} rows={3} maxLength={4000} className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Why we need it</span>
          <textarea value={draft.why} onChange={(e) => set({ why: e.target.value })} rows={2} maxLength={4000} className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">How to try it (one step per line)</span>
          <textarea value={draft.how} onChange={(e) => set({ how: e.target.value })} rows={4} className={field} />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Pictures</span>
            <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void addPictures(e.target.files).then(() => (e.target.value = ""))} />
            <Button type="button" size="sm" variant="outline" disabled={!canUpload || busy} onClick={() => fileInput.current?.click()} title={canUpload ? "Upload pictures" : "Pictures can't be uploaded in the demo"}>
              <ImagePlus className="mr-1 h-3.5 w-3.5" /> {busy ? "Uploading…" : "Add pictures"}
            </Button>
          </div>
          {draft.pictures.length === 0 && <p className="text-xs text-muted-foreground">No pictures yet.</p>}
          {draft.pictures.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
              <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={p.file}>
                {p.file}
                {!p.path && " (not uploaded)"}
              </span>
              <input
                value={p.caption}
                onChange={(e) => set({ pictures: draft.pictures.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })}
                maxLength={300}
                placeholder="Caption"
                aria-label={`Caption for ${p.file}`}
                className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${p.file}`} onClick={() => set({ pictures: draft.pictures.filter((_, j) => j !== i) })}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
      <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={busy}>
          {card ? "Save changes" : "Add card"}
        </Button>
      </div>
    </Modal>
  );
}

export { formatDecisionDate };
