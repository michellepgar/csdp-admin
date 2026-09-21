"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Lightbulb, Paperclip, UploadCloud, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { addSuggestion } from "@/app/(app)/suggestions/actions";
import { shrinkImageBlob } from "@/lib/shrink-image";
import {
  formatSuggestionFileSize,
  isImageFile,
  isPreviewableSuggestionImage,
  isVideoFile,
  MAX_SUGGESTION_DETAILS,
  MAX_SUGGESTION_FILES,
  MAX_SUGGESTION_FILE_BYTES,
  MAX_SUGGESTION_TITLE,
  SUGGESTION_ALLOWED_TYPES,
  SUGGESTION_BUCKET,
  suggestionTypeOf,
  validateSuggestionFile,
} from "@/lib/suggestions";
import { cn } from "@/lib/utils";

const ACCEPT = SUGGESTION_ALLOWED_TYPES.join(",") + ",.csv,.docx,.xlsx,.heic,.mov";

interface Picked {
  key: string;
  file: File;
  preview?: string;
}

function isDemoSession() {
  return document.cookie.includes("demo-mode=1");
}

/* "Got an idea?" -- a headline, a description as long as you like, and any
   screenshots or files. Drop files anywhere on the card, paste a screenshot
   straight from the clipboard, or use the attach button. Files upload to the
   private bucket first, then the suggestion is saved with them. */
export function SuggestionComposer() {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  // Grow the description box as it fills up, so a long write-up stays readable.
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [details]);

  // Free the preview pictures when the card goes away.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => {
    previewsRef.current = picked.map((p) => p.preview).filter((p): p is string => !!p);
  }, [picked]);
  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const next: Picked[] = [];
    for (const file of files) {
      const problem = validateSuggestionFile(file.name, file.type, file.size);
      if (problem) {
        setError(problem);
        continue;
      }
      // A pasted screenshot has a generic name; give it a readable one.
      const named = file.name === "image.png" || !file.name ? new File([file], `screenshot-${Date.now()}.png`, { type: file.type }) : file;
      next.push({ key: crypto.randomUUID(), file: named, preview: isPreviewableSuggestionImage(suggestionTypeOf(named.name, named.type)) ? URL.createObjectURL(named) : undefined });
    }
    setPicked((current) => {
      const merged = [...current, ...next];
      if (merged.length > MAX_SUGGESTION_FILES) {
        setError(`You can attach up to ${MAX_SUGGESTION_FILES} files.`);
        for (const extra of merged.slice(MAX_SUGGESTION_FILES)) if (extra.preview) URL.revokeObjectURL(extra.preview);
        return merged.slice(0, MAX_SUGGESTION_FILES);
      }
      return merged;
    });
  }

  function removeFile(key: string) {
    setPicked((current) => {
      const gone = current.find((p) => p.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return current.filter((p) => p.key !== key);
    });
  }

  function onPaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!title.trim()) {
      setError("Give your suggestion a short title.");
      return;
    }

    const uploaded: { path: string; name: string; type: string; size: number }[] = [];
    const supabase = createClient();
    try {
      if (picked.length > 0) {
        const demo = isDemoSession();
        let userId = "";
        if (!demo) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("You're signed out. Reload the page and try again.");
          userId = user.id;
        }
        for (const [index, item] of picked.entries()) {
          setBusy(`Uploading ${index + 1} of ${picked.length}…`);
          let blob: Blob = item.file;
          let name = item.file.name;
          let type = suggestionTypeOf(name, item.file.type);
          if (isPreviewableSuggestionImage(type) && type !== "image/gif") {
            const shrunk = await shrinkImageBlob(item.file);
            if (shrunk !== item.file) {
              blob = shrunk;
              type = shrunk.type || "image/jpeg";
              name = name.replace(/\.[^./\\]+$/, "") + ".jpg";
            }
          }
          if (blob.size > MAX_SUGGESTION_FILE_BYTES) throw new Error(`${name} is over 25 MB.`);
          if (demo) {
            // The demo has no storage -- it just records that a file was attached.
            uploaded.push({ path: `demo/${Date.now()}-${index}`, name, type, size: blob.size });
            continue;
          }
          const extension = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
          const path = `${userId}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from(SUGGESTION_BUCKET).upload(path, blob, { contentType: type, upsert: false });
          if (uploadError) throw new Error(`Couldn't upload ${name}. Check your connection and try again.`);
          uploaded.push({ path, name, type, size: blob.size });
        }
      }

      setBusy("Adding…");
      const data = new FormData();
      data.set("text", title);
      data.set("details", details);
      data.set("attachments", JSON.stringify(uploaded));
      const result = await addSuggestion(data);
      if (result.error) throw new Error(result.error);

      picked.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setTitle("");
      setDetails("");
      setPicked([]);
    } catch (problem) {
      // Don't leave uploaded files behind when the suggestion didn't save.
      if (uploaded.length > 0 && !isDemoSession()) void supabase.storage.from(SUGGESTION_BUCKET).remove(uploaded.map((u) => u.path));
      setError(problem instanceof Error ? problem.message : "Couldn't add your suggestion. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={submit}
      onPaste={onPaste}
      onDragOver={(event) => {
        if (event.dataTransfer?.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }
      }}
      className={cn(
        "max-w-3xl overflow-hidden rounded-2xl border bg-linear-to-b from-card to-ring/5 shadow-md transition-all",
        dragging ? "border-ring ring-4 ring-ring/25" : "border-ring/25",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-ring/15 bg-linear-to-r from-ring/15 to-transparent px-4 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-b from-ring to-ring/80 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_3px_rgb(0_0_0/0.3)]">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Got an idea?</p>
          <p className="text-xs text-muted-foreground">Describe it as fully as you like. Screenshots and files welcome.</p>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_SUGGESTION_TITLE}
          placeholder="Suggest something... (a short title)"
          aria-label="Suggestion title"
          className="h-9 w-full rounded-lg border px-3 text-sm font-medium"
        />
        <div>
          <textarea
            ref={detailsRef}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={MAX_SUGGESTION_DETAILS}
            rows={4}
            placeholder="Tell us more: what's the problem, what should it do, where in the tracker? Paste a screenshot right here."
            aria-label="Suggestion details"
            className="min-h-24 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed"
          />
          <div className="mt-0.5 text-right text-[11px] text-muted-foreground">
            {details.length}/{MAX_SUGGESTION_DETAILS}
          </div>
        </div>

        {picked.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {picked.map((item) => {
              const type = suggestionTypeOf(item.file.name, item.file.type);
              return (
                <li key={item.key} className="flex items-center gap-2.5 rounded-xl border bg-card p-1.5 pr-2 shadow-sm">
                  {item.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the person just chose
                    <img src={item.preview} alt="" className="h-12 w-12 flex-none rounded-lg border object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-ring/10 text-ring">
                      {isImageFile(type) ? <ImageIcon className="h-5 w-5" /> : isVideoFile(type) ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.file.name}</span>
                    <span className="block text-xs text-muted-foreground">{formatSuggestionFileSize(item.file.size)}</span>
                  </span>
                  <button type="button" onClick={() => removeFile(item.key)} disabled={!!busy} aria-label={`Remove ${item.file.name}`} className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ring/40 bg-ring/5 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-ring/10 hover:text-foreground"
        >
          <UploadCloud className="h-4 w-4 text-ring" />
          <span>
            <b className="font-semibold text-foreground">Drop screenshots or files here</b>, paste them, or click to choose
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <p className="text-[11px] text-muted-foreground">Photos, PDFs, Word, Excel, CSV, text, video or zip. Up to {MAX_SUGGESTION_FILES} files, 25 MB each. Everyone on the team can open them.</p>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
          <Button type="submit" disabled={!!busy || !title.trim()}>
            {picked.length > 0 && <Paperclip className="h-3.5 w-3.5" />}
            {busy ? "Adding…" : "Add suggestion"}
          </Button>
        </div>
      </div>
    </form>
  );
}
