"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, ImageIcon, Images, Plus, Printer, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDetails, CardForm, toneOf, TONE_CLASSES } from "@/components/feature-review-dialogs";
import {
  REVIEW_COLUMNS,
  applyDecisions,
  attachUploads,
  cardsFromSeed,
  exportBoard,
  isDecided,
  moveCard,
  parseImport,
  picturePaths,
  type ReviewCard,
  type ReviewContent,
  type ReviewStatus,
} from "@/lib/feature-review";
import { FEATURE_REVIEW_STARTING_CARDS } from "@/lib/feature-review-seed";
import { buildReviewReport, formatDecisionDate } from "@/lib/feature-review-report";
import { isDemoBrowser, pictureProblem, pictureUrls, removePictures, uploadPicture } from "@/lib/feature-review-files";
import { teamDateIso } from "@/lib/shift";

const REPORT_TITLE = "CSDP Visual Aid: feature review";

/* Prints a report without leaving the page: it's written into a hidden frame,
   which prints once its pictures have loaded. */
function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) return;
  doc.open();
  doc.write(html);
  doc.close();
  const images = Array.from(doc.images);
  const ready = Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((done) => ((img.onload = () => done()), (img.onerror = () => done()))))));
  void Promise.race([ready, new Promise((done) => setTimeout(done, 8000))]).then(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  });
}

/* Feature Review: a kanban board for going through new features with a client.
   Cards start in To be approved and move (drag, or the Decision in a card's
   details) as the client decides. */
export function FeatureReviewBlock({ blockId, content, onChange, onFlush }: { blockId: string; content: ReviewContent; onChange: (content: ReviewContent) => void; onFlush: () => void }) {
  const cards = content.cards;
  const [area, setArea] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ card: ReviewCard | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ReviewStatus | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [demo, setDemo] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  // The newest cards, for work that finishes later (uploads) or runs twice in a row.
  const latest = useRef(cards);
  useLayoutEffect(() => {
    latest.current = cards;
  }, [cards]);
  const picturesInput = useRef<HTMLInputElement>(null);

  // The demo has no file storage; that's only known in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The demo cookie can only be read after the page loads.
    setDemo(isDemoBrowser());
  }, []);

  // Viewable links for every uploaded picture the board uses (fetched once each).
  const pathsKey = [...picturePaths(cards)].sort().join("|");
  useEffect(() => {
    const missing = pathsKey ? pathsKey.split("|").filter((p) => !urls[p]) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    void pictureUrls(missing).then((found) => {
      if (!cancelled && Object.keys(found).length > 0) setUrls((prev) => ({ ...prev, ...found }));
    });
    return () => {
      cancelled = true;
    };
  }, [pathsKey, urls]);

  const areas = useMemo(() => [...new Set(cards.map((c) => c.area).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [cards]);
  const needle = query.trim().toLowerCase();
  const shown = cards.filter((c) => (!area || c.area === area) && (!needle || `${c.title} ${c.what}`.toLowerCase().includes(needle)));
  const decided = cards.filter((c) => isDecided(c.status)).length;
  const openCard = cards.find((c) => c.id === openId) ?? null;

  function setCards(next: ReviewCard[]) {
    const before = picturePaths(latest.current);
    const after = picturePaths(next);
    latest.current = next;
    onChange({ cards: next });
    // Pictures nothing uses any more are deleted from storage.
    const gone = [...before].filter((p) => !after.has(p));
    if (gone.length > 0) void removePictures(gone);
  }
  const updateCard = (card: ReviewCard) => setCards(latest.current.map((c) => (c.id === card.id ? card : c)));

  function say(tone: "ok" | "error", text: string) {
    setMessage({ tone, text });
  }

  function dropOn(status: ReviewStatus) {
    const card = cards.find((c) => c.id === dragId);
    setDragId(null);
    setOverColumn(null);
    if (card && card.status !== status) {
      updateCard(moveCard(card, status, teamDateIso()));
      onFlush();
    }
  }

  async function uploadInto(cardId: string, pictureId: string, file: File) {
    setBusy("Uploading picture…");
    const result = await uploadPicture(blockId, file);
    setBusy(null);
    if ("error" in result) return say("error", result.error);
    const card = latest.current.find((c) => c.id === cardId);
    if (!card) return;
    updateCard({ ...card, pictures: card.pictures.map((p) => (p.id === pictureId ? { ...p, path: result.path } : p)) });
    onFlush();
  }

  /* "Upload pictures": pick many files at once; each goes to every picture
     waiting for a file with that name. */
  async function uploadMatching(files: FileList | null) {
    if (!files || files.length === 0) return;
    const waiting = new Set(cards.flatMap((c) => c.pictures.filter((p) => !p.path).map((p) => p.file.toLowerCase())));
    const list = Array.from(files).filter((f) => waiting.has(f.name.toLowerCase()) && !pictureProblem(f));
    const skipped = files.length - list.length;
    if (list.length === 0) return say("error", "None of those files match a picture that's still waiting (the names must match, e.g. suggest-patient.png).");
    const uploaded: Record<string, string> = {};
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      const result = await uploadPicture(blockId, list[i]);
      if ("path" in result) uploaded[list[i].name] = result.path;
      else failed++;
    }
    setBusy(null);
    const { cards: next, filled } = attachUploads(latest.current, uploaded);
    setCards(next);
    onFlush();
    say(failed ? "error" : "ok", `${filled} picture${filled === 1 ? "" : "s"} added.${skipped ? ` ${skipped} file${skipped === 1 ? "" : "s"} didn't match a waiting picture.` : ""}${failed ? ` ${failed} couldn't be uploaded -- try those again.` : ""}`);
  }

  function exportFile() {
    const blob = new Blob([exportBoard(content)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `feature-review-${teamDateIso()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const result = parseImport(await file.text());
    if (result.kind === "error") return say("error", result.message);
    if (result.kind === "decisions") {
      const { cards: next, matched } = applyDecisions(cards, result.decisions);
      if (matched === 0) return say("error", "None of the cards in that board file are on this board.");
      if (!window.confirm(`Bring over the decisions, dates and comments for ${matched} card${matched === 1 ? "" : "s"} from ${file.name}?`)) return;
      setCards(next);
      onFlush();
      return say("ok", `Decisions brought over for ${matched} card${matched === 1 ? "" : "s"}.`);
    }
    if (cards.length > 0 && !window.confirm(`Replace the ${cards.length} cards on this board with the ${result.cards.length} in ${file.name}?`)) return;
    setCards(result.cards);
    onFlush();
    say("ok", `${result.cards.length} card${result.cards.length === 1 ? "" : "s"} imported.`);
  }

  async function print(list: ReviewCard[], single: boolean) {
    const paths = [...picturePaths(list)];
    const fresh = paths.length ? await pictureUrls(paths) : {};
    printHtml(buildReviewReport(list, { ...urls, ...fresh }, { title: single ? list[0].title : REPORT_TITLE, single }));
  }

  function deleteCard(card: ReviewCard) {
    if (!window.confirm(`Delete "${card.title}"? Its pictures and comments go with it.`)) return;
    setOpenId(null);
    setCards(cards.filter((c) => c.id !== card.id));
    onFlush();
  }

  const toolField = "h-8 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      {/* Top of the board: filter, find, counter and actions. */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area" className={toolField}>
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find" aria-label="Find a feature" className={`${toolField} w-40 pl-7`} />
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {shown.length} of {cards.length} features shown · {decided} decided
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" onClick={() => setForm({ card: null })}>
            <Plus className="h-3.5 w-3.5" /> Add card
          </Button>
          <input ref={picturesInput} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void uploadMatching(e.target.files).then(() => (e.target.value = ""))} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={demo || !!busy}
            onClick={() => picturesInput.current?.click()}
            title={demo ? "Pictures can't be uploaded in the demo" : "Pick many picture files at once; each goes to the picture with the same file name"}
          >
            <Images className="h-3.5 w-3.5" /> Upload pictures
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={cards.length === 0} onClick={() => void print(cards, false)}>
            <Printer className="h-3.5 w-3.5" /> Print report
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={cards.length === 0} onClick={exportFile} title="Download the whole board as a file, as a backup">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0]).then(() => (e.target.value = ""))} />
          <Button type="button" size="sm" variant="outline" onClick={() => importInput.current?.click()} title="Load a board file: this board's Export, or the local board's “Save board file”">
            <FileUp className="h-3.5 w-3.5" /> Import
          </Button>
        </div>
      </div>
      {(busy || message) && (
        <div className={`flex items-center gap-2 border-b px-3 py-1.5 text-sm ${busy ? "bg-primary/5 text-foreground" : message?.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-status-success text-status-success-foreground"}`} role="status">
          <span className="flex-1">{busy ?? message?.text}</span>
          {!busy && (
            <button type="button" onClick={() => setMessage(null)} className="text-xs underline underline-offset-2">
              Dismiss
            </button>
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">No features on this board yet. Start with the CSDP visual aid&apos;s feature list, or add your own cards.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setCards(cardsFromSeed(FEATURE_REVIEW_STARTING_CARDS));
                onFlush();
              }}
            >
              Add the {FEATURE_REVIEW_STARTING_CARDS.length} CSDP feature cards
            </Button>
            <Button type="button" variant="outline" onClick={() => setForm({ card: null })}>
              <Plus className="h-4 w-4" /> Add a card
            </Button>
          </div>
        </div>
      ) : (
        /* 4 columns on a computer, 2 on a tablet, 1 on a phone -- by the board's own width. */
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto p-3 @min-[560px]:grid-cols-2 @min-[980px]:grid-cols-4">
          {REVIEW_COLUMNS.map((column) => {
            const tone = TONE_CLASSES[column.tone];
            const inColumn = shown.filter((c) => c.status === column.status);
            return (
              <section
                key={column.status}
                aria-label={column.name}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  if (overColumn !== column.status) setOverColumn(column.status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(column.status);
                }}
                className={`flex min-h-40 flex-col rounded-xl border bg-muted/25 transition-colors ${overColumn === column.status ? tone.over : ""}`}
              >
                <h3 className={`flex items-center gap-2 rounded-t-xl px-3 py-2 text-sm font-semibold ${tone.head}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden />
                  <span className="flex-1">{column.name}</span>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs tabular-nums">{inColumn.length}</span>
                </h3>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {inColumn.length === 0 && <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed px-3 py-6 text-xs text-muted-foreground">Drop cards here</div>}
                  {inColumn.map((card) => {
                    const first = card.pictures[0];
                    const thumb = first?.path ? urls[first.path] : undefined;
                    return (
                      <article
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(card.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", card.title);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverColumn(null);
                        }}
                        onClick={() => setOpenId(card.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenId(card.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${card.title} (${column.name})`}
                        className={`group cursor-pointer overflow-hidden rounded-lg border border-l-4 bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring ${toneOf(card.status).border} ${dragId === card.id ? "opacity-40" : ""}`}
                      >
                        {first &&
                          (thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not a static asset
                            <img src={thumb} alt="" loading="lazy" draggable={false} className="h-[110px] w-full border-b object-cover object-left-top" />
                          ) : (
                            <div className="flex h-[110px] flex-col items-center justify-center gap-1 border-b bg-muted/40 text-[11px] text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                              <span className="max-w-full truncate px-2">{first.path ? "Loading…" : first.file}</span>
                            </div>
                          ))}
                        <div className="space-y-1 p-2.5">
                          {card.area && <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{card.area}</span>}
                          <div className="text-sm font-semibold leading-snug">{card.title}</div>
                          {(card.decisionDate || card.comments.trim()) && (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {card.decisionDate && <span>Decided {formatDecisionDate(card.decisionDate)}</span>}
                              {card.comments.trim() && <span title="Has client comments">💬</span>}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {openCard && (
        <CardDetails
          card={openCard}
          urls={urls}
          canUpload={!demo}
          onChange={updateCard}
          onUpload={(pictureId, file) => void uploadInto(openCard.id, pictureId, file)}
          onEdit={() => {
            setForm({ card: openCard });
            setOpenId(null);
          }}
          onDelete={() => deleteCard(openCard)}
          onPrint={() => void print([openCard], true)}
          onClose={() => {
            setOpenId(null);
            onFlush();
          }}
        />
      )}
      {form && (
        <CardForm
          card={form.card}
          areas={areas}
          canUpload={!demo}
          upload={(file) => uploadPicture(blockId, file)}
          onCancel={() => setForm(null)}
          onSave={(card) => {
            const exists = cards.some((c) => c.id === card.id);
            setCards(exists ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card]);
            onFlush();
            setForm(null);
            if (!exists) say("ok", `“${card.title}” added to To be approved.`);
          }}
        />
      )}
    </div>
  );
}
