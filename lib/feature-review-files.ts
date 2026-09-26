/* Pictures on Feature Review cards: files in the private "workspace-files"
   storage bucket, in a folder named after the signed-in user's id (only they
   can read or change it -- see supabase/phase78_feature_review.sql). The
   demo has no storage, so pictures there stay placeholders. */
import { createClient } from "@/lib/supabase/client";

export const WORKSPACE_FILES_BUCKET = "workspace-files";
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const URL_SECONDS = 60 * 60;

export function isDemoBrowser(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").includes("demo-mode=1");
}

export function pictureProblem(file: File): string | null {
  if (!PICTURE_TYPES.includes(file.type)) return `${file.name} isn't a picture (PNG, JPG, WEBP or GIF).`;
  if (file.size > MAX_PICTURE_BYTES) return `${file.name} is over 10 MB.`;
  return null;
}

/** Uploads one picture for a board; returns where it is stored. */
export async function uploadPicture(blockId: string, file: File): Promise<{ path: string } | { error: string }> {
  if (isDemoBrowser()) return { error: "Pictures can't be uploaded in the demo." };
  const problem = pictureProblem(file);
  if (problem) return { error: problem };
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "You're signed out -- sign in again to upload pictures." };
  const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-100) || "picture";
  const unique = crypto.randomUUID().slice(0, 8);
  const path = `${data.user.id}/${blockId}/${unique}-${safeName}`;
  const { error } = await supabase.storage.from(WORKSPACE_FILES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Couldn't upload ${file.name}: ${error.message}` };
  return { path };
}

/** Viewable links for stored pictures (valid for an hour). Missing ones are left out. */
export async function pictureUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0 || isDemoBrowser()) return {};
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(WORKSPACE_FILES_BUCKET).createSignedUrls(paths, URL_SECONDS);
  if (error || !data) return {};
  const urls: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

/** Deletes stored pictures nothing uses any more. Best effort: a leftover file only takes space. */
export async function removePictures(paths: string[]): Promise<void> {
  if (paths.length === 0 || isDemoBrowser()) return;
  await createClient().storage.from(WORKSPACE_FILES_BUCKET).remove(paths);
}
