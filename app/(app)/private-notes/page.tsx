import { redirect } from "next/navigation";
import { PRIVATE_NOTES_HREF } from "@/lib/workspace-last-place";

/* Private Notes moved into My Workspace (its Private Notes tab). Old links --
   bookmarks, notifications, search results -- land there, keeping the search
   or the note they pointed at. */
export default async function PrivateNotesPage({ searchParams }: { searchParams: Promise<{ q?: string; highlightNote?: string }> }) {
  const { q, highlightNote } = await searchParams;
  const extra = new URLSearchParams();
  if (q) extra.set("q", q);
  if (highlightNote) extra.set("highlightNote", highlightNote);
  const rest = extra.toString();
  redirect(rest ? `${PRIVATE_NOTES_HREF}&${rest}` : PRIVATE_NOTES_HREF);
}
