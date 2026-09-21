"use server";

import { revalidatePath } from "next/cache";
import { SUPERADMIN_NAME, canDeleteSuggestion } from "@/lib/app-state";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import { MAX_SUGGESTION_DETAILS, MAX_SUGGESTION_FILES, MAX_SUGGESTION_TITLE, SUGGESTION_BUCKET } from "@/lib/suggestions";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type NewAttachment = { path: string; name: string; type: string; size: number };

/* Adds a suggestion: a short headline, an optional long description and any
   files already uploaded to the private bucket (the browser uploads them
   first, then hands over their paths here). Returns { error } rather than
   throwing so a real message reaches the form. */
export async function addSuggestion(formData: FormData): Promise<{ error: string | null }> {
  const text = ((formData.get("text") as string) || "").trim();
  const details = ((formData.get("details") as string) || "").trim();
  let attachments: NewAttachment[] = [];
  try {
    attachments = JSON.parse((formData.get("attachments") as string) || "[]");
  } catch {
    return { error: "Couldn't read the attached files. Try again." };
  }
  if (!text) return { error: "Give your suggestion a short title." };
  if (text.length > MAX_SUGGESTION_TITLE) return { error: `Keep the title under ${MAX_SUGGESTION_TITLE} characters. Put the rest in the description.` };
  if (details.length > MAX_SUGGESTION_DETAILS) return { error: `The description can be up to ${MAX_SUGGESTION_DETAILS} characters.` };
  if (!Array.isArray(attachments) || attachments.length > MAX_SUGGESTION_FILES) return { error: `You can attach up to ${MAX_SUGGESTION_FILES} files.` };

  if (await isDemoMode()) {
    await demoMutate((state) => {
      const id = `demo-${Date.now()}`;
      (state.suggestions ??= []).push({
        id,
        text,
        details: details || undefined,
        attachments: attachments.map((a, i) => ({ id: `${id}-f${i}`, path: a.path, name: a.name, type: a.type, size: a.size })),
        author: "Jane",
        status: "Requested",
        createdAt: new Date().toISOString(),
      });
    });
    revalidatePath("/suggestions");
    return { error: null };
  }

  try {
    const { supabase, me } = await requireTeamMember();
    const id = crypto.randomUUID();
    const { error } = await supabase.from("suggestions").insert({
      id,
      text,
      author: me.name,
      status: "Requested",
      ...(details ? { details } : {}),
    });
    if (error) {
      if (details && /details/i.test(error.message)) return { error: "Descriptions aren't set up yet. Ask Michelle to run the latest database update." };
      throw new Error(error.message);
    }
    if (attachments.length > 0) {
      const { error: attachError } = await supabase.from("suggestion_attachments").insert(
        attachments.map((a) => ({ suggestion_id: id, path: a.path, name: a.name, type: a.type, size: a.size })),
      );
      if (attachError) {
        // Don't leave a half-made suggestion behind.
        await supabase.from("suggestions").delete().eq("id", id);
        await supabase.storage.from(SUGGESTION_BUCKET).remove(attachments.map((a) => a.path));
        return { error: "Couldn't save the attached files. Try again, or ask Michelle to run the latest database update." };
      }
    }
    revalidatePath("/suggestions");
    return { error: null };
  } catch (error) {
    console.error("Add suggestion failed", error);
    return { error: "Couldn't add your suggestion. Try again." };
  }
}

/* Signed picture links for the screenshots on the board (the bucket is
   private, so a bare path can't be shown). */
export async function getSuggestionAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  const wanted = Array.from(new Set(paths)).filter((path) => !path.startsWith("demo/")).slice(0, 80);
  if (wanted.length === 0) return {};
  try {
    if (await isDemoMode()) return {};
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.storage.from(SUGGESTION_BUCKET).createSignedUrls(wanted, 60 * 60);
    if (error || !data) return {};
    const urls: Record<string, string> = {};
    for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    return urls;
  } catch {
    return {};
  }
}

/* A link that makes the browser SAVE the file with its own name. */
export async function getSuggestionDownloadUrl(path: string, filename: string): Promise<{ url: string | null; error: string | null }> {
  try {
    if (await isDemoMode()) return { url: null, error: "Downloads aren't available in the demo." };
    const { supabase } = await requireTeamMember();
    const { data, error } = await supabase.storage.from(SUGGESTION_BUCKET).createSignedUrl(path, 120, { download: filename });
    if (error || !data) return { url: null, error: "That file is no longer available." };
    return { url: data.signedUrl, error: null };
  } catch {
    return { url: null, error: "Couldn't prepare the download. Try again." };
  }
}

export async function setSuggestionStatus(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (status !== "Requested" && status !== "Working On It" && status !== "Added") return;

  // The demo's "Jane" isn't the real SUPERADMIN_NAME this is normally
  // gated to -- letting the demo account try every status here (not
  // just add/remove) is the whole point, so this one check is skipped
  // in demo mode rather than made to always fail for her.
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const suggestion = (state.suggestions || []).find((s) => s.id === id);
      if (suggestion) suggestion.status = status;
    });
    revalidatePath("/suggestions");
    return;
  }

  const { supabase, me } = await requireTeamMember();
  if (me.name !== SUPERADMIN_NAME) throw new Error("Not authorized");

  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  orThrow(error);
  revalidatePath("/suggestions");
}

/* Same rule as canDeleteSuggestion in lib/app-state.ts: only the person
   who posted it, or Michelle. */
export async function removeSuggestion(formData: FormData) {
  const id = formData.get("id") as string;

  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.suggestions = (state.suggestions || []).filter((s) => !(s.id === id && canDeleteSuggestion(s, "Jane")));
    });
    revalidatePath("/suggestions");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { data: suggestion } = await supabase.from("suggestions").select("author").eq("id", id).maybeSingle();
  if (!suggestion) return;

  if (!canDeleteSuggestion({ id, text: "", author: suggestion.author, createdAt: "", status: "Requested" }, me.name)) return;

  // Take the attached files out of storage too (the rows go with the suggestion).
  const { data: files } = await supabase.from("suggestion_attachments").select("path").eq("suggestion_id", id);
  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  orThrow(error);
  const paths = (files || []).map((f) => f.path as string);
  if (paths.length > 0) await supabase.storage.from(SUGGESTION_BUCKET).remove(paths);
  revalidatePath("/suggestions");
}
