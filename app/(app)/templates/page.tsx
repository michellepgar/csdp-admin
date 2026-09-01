import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, findVaByEmail } from "@/lib/app-state";
import { TemplatesList } from "@/components/templates-list";
import { saveTemplate, removeTemplate } from "./actions";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email Templates</h1>
      <TemplatesList
        templates={state.emailTemplates || []}
        saveTemplate={saveTemplate}
        removeTemplate={removeTemplate}
      />
    </div>
  );
}
