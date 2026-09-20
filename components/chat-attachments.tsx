"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Download, FileSpreadsheet, FileText, ImageIcon, Paperclip, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getChatAttachmentDownloadUrl, getChatAttachmentUrls, removeChatAttachment, sendChatMessage } from "@/app/(app)/messages/actions";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_RETENTION_DAYS,
  attachmentDaysLeft,
  attachmentTypeOf,
  CHAT_ATTACHMENT_BUCKET,
  formatFileSize,
  isImageType,
  isPreviewableImage,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/chat";
import { shrinkImageBlob } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

/* Everything the chat needs for attachments, shared by the full Messages
   page (chat-view.tsx) and the floating window (floating-chat.tsx):
   choosing/pasting/dropping a file, uploading it (photos shrunk first),
   showing it inside a message, and downloading it to the device. */

export const ATTACH_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(",") + ",.csv,.docx,.xlsx,.heic";
/* Says who can open the files (so nobody sends something private to the
   whole team by accident) and when they go away. */
export function attachmentHint(isTeamRoom: boolean): string {
  const who = isTeamRoom ? "Everyone on the team can open files sent here." : "Only the two of you can open files sent here.";
  return `Photos and documents up to 10 MB. ${who} Files are deleted after ${ATTACHMENT_RETENTION_DAYS} days, so download what you want to keep.`;
}

function isDemoSession() {
  return document.cookie.includes("demo-mode=1");
}

/* Uploads the file (if any) and posts the message. Photos are shrunk
   before upload; the file goes to the person's own folder in the private
   bucket, then the message row points at it. If posting fails after the
   upload, the orphaned file is removed again. */
export async function sendChat(room: string, text: string, file: File | null): Promise<{ error: string | null; message?: ChatMessage }> {
  if (!file) return sendChatMessage(room, text);

  let type = attachmentTypeOf(file.name, file.type);
  const problem = validateAttachment(file.name, type, file.size);
  if (problem) return { error: problem };

  let blob: Blob = file;
  let name = file.name;
  if (isPreviewableImage(type)) {
    const shrunk = await shrinkImageBlob(file);
    if (shrunk !== file) {
      blob = shrunk;
      type = shrunk.type || "image/jpeg";
      name = name.replace(/\.[^./\\]+$/, "") + ".jpg";
    }
  }
  if (blob.size > MAX_ATTACHMENT_BYTES) return { error: "Files can be up to 10 MB." };

  // The demo has no storage -- it just records that a file was attached.
  if (isDemoSession()) return sendChatMessage(room, text, { path: `demo/${Date.now()}`, name, type, size: blob.size });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Reload the page and try again." };

  const extension = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (uploadError) return { error: "Couldn't upload that file. Check your connection and try again." };

  const result = await sendChatMessage(room, text, { path, name, type, size: blob.size });
  if (result.error) void supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([path]);
  return result;
}

/* Picks a file from a paste (a copied screenshot/photo) -- undefined when
   the clipboard has no file. */
export function fileFromClipboard(event: React.ClipboardEvent): File | undefined {
  const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.kind === "file");
  return item?.getAsFile() ?? undefined;
}

/* The paperclip button (opens the file picker). */
export function AttachButton({ onPick, disabled, className }: { onPick: (file: File) => void; disabled?: boolean; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACH_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach a photo or document"
        title="Attach a photo or document"
        className={cn("flex flex-none items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted disabled:opacity-50", className ?? "h-10 w-10")}
      >
        <Paperclip className="h-4 w-4" />
      </button>
    </>
  );
}

/* The chosen-but-not-yet-sent file, shown above the message box. */
export function PendingAttachment({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const type = attachmentTypeOf(file.name, file.type);
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs">
      <FileIcon type={type} className="h-4 w-4 flex-none text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
      <span className="flex-none text-muted-foreground">{formatFileSize(file.size)}</span>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label="Remove attachment" className="flex h-5 w-5 flex-none items-center justify-center rounded hover:bg-muted">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  if (isImageType(type)) return <ImageIcon className={className} />;
  if (type.includes("sheet") || type.includes("excel") || type === "text/csv") return <FileSpreadsheet className={className} />;
  return <FileText className={className} />;
}

/* Signed picture links for every previewable, still-available image in
   the open chat (the bucket is private, so a bare path can't be shown). */
export function useAttachmentUrls(messages: ChatMessage[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const wanted = messages
      .map((m) => m.attachment)
      .filter((a): a is ChatAttachment => !!a && !a.expired && isPreviewableImage(a.type) && !requested.current.has(a.path))
      .map((a) => a.path);
    if (wanted.length === 0) return;
    for (const path of wanted) requested.current.add(path);
    void getChatAttachmentUrls(wanted).then((found) => {
      if (Object.keys(found).length > 0) setUrls((current) => ({ ...current, ...found }));
    });
  }, [messages]);

  return urls;
}

async function downloadAttachment(attachment: ChatAttachment): Promise<string | null> {
  const result = await getChatAttachmentDownloadUrl(attachment.path, attachment.name);
  if (!result.url) return result.error ?? "Couldn't download that file.";
  // The signed link carries a "save as" header, so this saves the file
  // to the device (with its original name) rather than navigating away.
  const link = document.createElement("a");
  link.href = result.url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return null;
}

/* How long the file has left, so nobody is surprised when it disappears:
   calm while there's time, amber in the last three days, red on the last
   day. The reminder to download what you want to keep. */
function ExpiryPill({ sentAt, mine }: { sentAt: string; mine: boolean }) {
  const days = attachmentDaysLeft(sentAt);
  if (days < 0) return null;
  const label = days === 0 ? "Deletes today" : days === 1 ? "Deletes tomorrow" : `Deletes in ${days} days`;
  const tone =
    days <= 1
      ? "bg-red-100 text-red-800 dark:bg-red-500/25 dark:text-red-200"
      : days <= 3
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
        : mine
          ? "bg-primary-foreground/20 text-primary-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)} title="Download it to keep it -- files are deleted automatically">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

/* An attachment inside a message bubble: a photo thumbnail (click to
   enlarge, with a download button in the popup) or a file card with a
   Download button. */
export function MessageAttachment({
  attachment,
  url,
  mine,
  compact,
  messageId,
  onChanged,
  sentAt,
}: {
  attachment: ChatAttachment;
  url?: string;
  mine: boolean;
  compact?: boolean;
  /** With onChanged, lets the sender delete the file early. */
  messageId?: string;
  onChanged?: (message: ChatMessage) => void;
  /** When the message was sent -- drives the "Deletes in N days" reminder. */
  sentAt?: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteFile() {
    if (!messageId || !window.confirm("Delete this file for everyone in the chat? This can't be undone.")) return;
    setDeleting(true);
    const result = await removeChatAttachment(messageId);
    setDeleting(false);
    if (result.error) setDownloadError(result.error);
    else if (result.message) onChanged?.(result.message);
  }
  const canDelete = mine && !!messageId && !!onChanged;
  const deleteButton = canDelete && (
    <button
      type="button"
      onClick={() => void deleteFile()}
      disabled={deleting}
      aria-label={`Delete ${attachment.name}`}
      title="Delete this file for everyone"
      className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-md disabled:opacity-50", mine ? "hover:bg-primary-foreground/20" : "hover:bg-muted")}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );

  async function download() {
    setDownloading(true);
    setDownloadError(await downloadAttachment(attachment));
    setDownloading(false);
  }

  if (attachment.expired) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-xs", mine ? "border-primary-foreground/40 text-primary-foreground/80" : "text-muted-foreground")}>
        <FileIcon type={attachment.type} className="h-4 w-4 flex-none" />
        <span className="min-w-0">
          <span className="block truncate">{attachment.name}</span>
          <span className="block">{attachment.removed ? (mine ? "You deleted this file" : "Deleted by the sender") : `Removed after ${ATTACHMENT_RETENTION_DAYS} days`}</span>
        </span>
      </div>
    );
  }

  if (isPreviewableImage(attachment.type) && url) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not something next/image can optimize. */}
        <img
          src={url}
          alt={attachment.name}
          onClick={() => setZoomed(true)}
          className={cn("cursor-zoom-in rounded-lg object-cover", compact ? "max-h-40 max-w-full" : "max-h-56 max-w-full")}
        />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {sentAt && <ExpiryPill sentAt={sentAt} mine={mine} />}
          <button type="button" onClick={() => void download()} disabled={downloading} className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] disabled:opacity-50", mine ? "hover:bg-primary-foreground/20" : "hover:bg-muted")}>
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          {deleteButton}
        </div>
        {zoomed && <ImageLightbox src={url} onClose={() => setZoomed(false)} onDownload={download} />}
        {downloadError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{downloadError}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className={cn("flex items-center gap-2.5 rounded-lg border px-2.5 py-2", mine ? "border-primary-foreground/30 bg-primary-foreground/10" : "bg-muted/40")}>
        <FileIcon type={attachment.type} className="h-5 w-5 flex-none" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{attachment.name}</span>
          <span className={cn("block text-[11px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{formatFileSize(attachment.size)}</span>
          {sentAt && (
            <span className="mt-1 block">
              <ExpiryPill sentAt={sentAt} mine={mine} />
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          aria-label={`Download ${attachment.name}`}
          title="Download to your device"
          className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-md disabled:opacity-50", mine ? "hover:bg-primary-foreground/20" : "hover:bg-muted")}
        >
          <Download className="h-4 w-4" />
        </button>
        {deleteButton}
      </div>
      {downloadError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{downloadError}</p>}
    </div>
  );
}
