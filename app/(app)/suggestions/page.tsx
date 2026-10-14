import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, type AppPart } from "@/lib/fetch-app-state";
import { findVaByEmail, SUPERADMIN_NAME } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { SuggestionsList } from "@/components/suggestions-list";
import { SuggestionComposer } from "@/components/suggestion-composer";
import { setSuggestionStatus, removeSuggestion } from "./actions";

/* Only the data this page shows (see AppPart in lib/fetch-app-state.ts). */
const PARTS: AppPart[] = ["core", "suggestions"];

export default async function SuggestionsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState(PARTS);
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div>
      <PageHeader title="Suggestions" />
      <PageBody gap={8}>
        <SuggestionComposer />

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
