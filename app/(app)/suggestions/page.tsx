import { redirect } from "next/navigation";
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
        <form action={addSuggestion} className="flex gap-2 max-w-lg">
          <input
            type="text"
            name="text"
            placeholder="Suggest something..."
            required
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        <SuggestionsList
          suggestions={state.suggestions || []}
          currentUserName={me.name}
          isMichelle={me.name === SUPERADMIN_NAME}
          teamNames={state.vas.map((v) => v.name)}
          setSuggestionStatus={setSuggestionStatus}
          removeSuggestion={removeSuggestion}
        />
      </PageBody>
    </div>
  );
}
