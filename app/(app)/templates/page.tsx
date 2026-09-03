import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
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
    <div>
      <PageHeader title="Email Templates" />
      <PageBody>
        <TemplatesList
          templates={state.emailTemplates || []}
          saveTemplate={saveTemplate}
          removeTemplate={removeTemplate}
        />
      </PageBody>
    </div>
  );
}
