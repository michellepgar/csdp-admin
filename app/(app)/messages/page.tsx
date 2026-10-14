import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, type AppPart } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { ChatView } from "@/components/chat-view";

/* Only the data this page shows (see AppPart in lib/fetch-app-state.ts). */
const PARTS: AppPart[] = ["core"];

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState(PARTS);
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const { room } = await searchParams;
  const people = state.vas
    .filter((v) => v.name !== me.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({ id: v.id, name: v.name, color: v.color }));

  return (
    <div>
      <PageHeader title="Messages" />
      <PageBody roomForFloatingButtons={false}>
        <ChatView me={me.name} people={people} initialRoom={room} canAddPriority={isAdmin(me)} />
      </PageBody>
    </div>
  );
}
