/* Suggestions: a short headline, an optional long description, and any
   number of screenshots or files. Kept in step with
   supabase/phase65_suggestion_attachments.sql (the bucket's own size limit and
   allowed types) -- the database is the real gate; these checks just give a
   friendly message before uploading. */

export const SUGGESTION_BUCKET = "suggestion-attachments";
export const MAX_SUGGESTION_TITLE = 200;
export const MAX_SUGGESTION_DETAILS = 5000;
export const MAX_SUGGESTION_FILES = 8;
export const MAX_SUGGESTION_FILE_BYTES = 25 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  zip: "application/zip",
};

export const SUGGESTION_ALLOWED_TYPES = Array.from(new Set([...Object.values(EXTENSION_TYPES), "application/x-zip-compressed"]));

/* The file's MIME type, falling back to its extension when the browser gives
   none (common for .csv/.docx on some systems). */
export function suggestionTypeOf(name: string, mime: string): string {
  if (mime && SUGGESTION_ALLOWED_TYPES.includes(mime)) return mime;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? mime;
}

export function validateSuggestionFile(name: string, mime: string, size: number): string | null {
  if (size <= 0) return `${name} is empty.`;
  if (size > MAX_SUGGESTION_FILE_BYTES) return `${name} is over 25 MB.`;
  if (!SUGGESTION_ALLOWED_TYPES.includes(suggestionTypeOf(name, mime))) {
    return `${name}: you can attach photos, screenshots, PDFs, Word, Excel, CSV, text, video or zip files.`;
  }
  return null;
}

export const isImageFile = (type: string) => type.startsWith("image/");
export const isPreviewableSuggestionImage = (type: string) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type);
export const isVideoFile = (type: string) => type.startsWith("video/");

export function formatSuggestionFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
