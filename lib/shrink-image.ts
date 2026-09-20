/* Shrinks a pasted screenshot/photo before it's embedded in a note or
   comment. Notes store a pasted image as a base64 data URL right inside
   the note's own HTML (see lib/sanitize-note-html.ts), so a raw phone
   photo or full-screen screenshot -- easily 2-5 MB -- gets saved into
   the database as-is, and re-downloaded on every page view. Resizing to
   a sensible maximum and re-encoding as JPEG typically cuts that by
   ~10x while staying easily readable.

   Browser-only (canvas). fitWithin() is pure so it can be unit tested. */

export const MAX_IMAGE_DIMENSION = 1400;
const JPEG_QUALITY = 0.8;
// Small images that already fit are left exactly as they are -- no point
// re-encoding a tiny clean PNG (and JPEG would only blur its text).
const SKIP_UNDER_BYTES = 120 * 1024;

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unreadable image")));
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable image"));
    reader.readAsDataURL(blob);
  });
}

/* Returns a data URL for `file`, shrunk when that actually helps. Never
   throws for an image the browser can't decode or re-encode -- it falls
   back to the original bytes, so pasting always still works. */
export async function shrinkImageToDataUrl(file: File): Promise<string> {
  return readAsDataUrl(await shrinkImageBlob(file));
}

/* Same shrinking, but returns the bytes (for uploading a file) instead of
   a data URL. Returns `file` itself when shrinking doesn't help or the
   browser can't decode it (e.g. an iPhone HEIC in Chrome). */
export async function shrinkImageBlob(file: File): Promise<Blob> {
  const original: Blob = file;
  // GIFs would lose their animation on a canvas; leave them alone.
  if (file.type === "image/gif") return original;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_DIMENSION);
    const alreadyFits = width === bitmap.width && height === bitmap.height;
    if (alreadyFits && file.size < SKIP_UNDER_BYTES) {
      bitmap.close();
      return original;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return original;
    }
    // JPEG has no transparency -- paint white underneath so a transparent
    // PNG doesn't turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    // Keep whichever is smaller -- a small, flat PNG can be bigger as a JPEG.
    if (!blob || blob.size >= file.size) return original;
    return blob;
  } catch {
    return original;
  }
}
