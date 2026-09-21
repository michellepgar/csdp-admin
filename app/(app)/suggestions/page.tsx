import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, SUPERADMIN_NAME } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { SuggestionsList } from "@/components/suggestions-list";
import { SubmitButton } from "@/components/submit-button";
import { addSuggestion, setSuggestionStatus, removeSuggestion } from "./actions";

export default async function SuggestionsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div>
      <PageHeader title="Suggestions" />
      <PageBody gap={8}>
        <form action={addSuggestion} className="max-w-xl overflow-hidden rounded-2xl border border-ring/25 bg-linear-to-b from-card to-ring/5 shadow-md">
          <div className="flex items-center gap-2.5 border-b border-ring/15 bg-linear-to-r from-ring/15 to-transparent px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-b from-ring to-ring/80 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_3px_rgb(0_0_0/0.3)]">
              <Lightbulb className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Got an idea?</p>
              <p className="text-xs text-muted-foreground">Tell us what would make the tracker better.</p>
            </div>
          </div>
          <div className="flex gap-2 p-3">
            <input
              type="text"
              name="text"
              placeholder="Suggest something..."
              required
              className="h-9 flex-1 rounded-lg border px-3 text-sm"
            />
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </div>
        </form>

        <SuggestionsList
          suggestions={state.suggestions || []}
          currentUserName={me.name}
          isMichelle={me.name === SUPERADMIN_NAME}
          vas={state.vas}
          setSuggestionStatus={setSuggestionStatus}
          removeSuggestion={removeSuggestion}
        />
      </PageBody>
    </div>
  );
}
