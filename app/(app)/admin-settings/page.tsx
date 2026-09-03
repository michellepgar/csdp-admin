import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { DownloadBackupButton } from "@/components/download-backup-button";
import { SubmitButton } from "@/components/submit-button";
import { restoreBackup, resetAllTasks } from "./actions";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) redirect("/overview");

  return (
    <div className="space-y-8">
      <PageHeader title="Backup & School Year" userName={me.name} />

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Backup &amp; Restore</h2>
        <p className="text-sm text-muted-foreground">
          Download a copy of everything in the tracker — schools, tasks, checklist progress, email tracker, distribution list,
          contacts, notes, all of it — anytime you want. Save the file somewhere safe (Google Drive, email it to yourself).
          If something ever breaks, restoring that file below puts everything back exactly as it was when you downloaded it.
        </p>
        <DownloadBackupButton state={state} />

        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-sm">
            <strong>Restore from a backup file</strong> — this replaces <strong>everything</strong> currently in the tracker
            with what&apos;s in the file you pick. This cannot be undone.
          </p>
          <form action={restoreBackup} className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept=".json" required className="text-sm" />
            <input
              type="text"
              name="confirm"
              placeholder="Type RESTORE to confirm"
              autoComplete="off"
              className="max-w-[200px] rounded-md border px-2 py-1.5 text-sm"
            />
            <SubmitButton pendingLabel="Restoring…" variant="destructive">Restore</SubmitButton>
          </form>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-destructive/50 p-4">
        <h2 className="text-lg font-semibold text-destructive">Start New School Year</h2>
        <p className="text-sm text-muted-foreground">
          Clears every school&apos;s Tasks list — file names, statuses, counts, and VA signatures — so each school starts the
          new year with an empty Tasks section. Also clears every school&apos;s Yearly Checklist progress (who checked off
          what, and when) back to unchecked — the checklist&apos;s own items are <strong>not</strong> deleted, just the
          checkmarks. Schools themselves, VA assignments, Email Tracker, Notes, and Issues &amp; Concerns are{" "}
          <strong>not</strong> touched. EOD Reports keep rolling into their own monthly archive automatically. This cannot
          be undone.
        </p>
        <form action={resetAllTasks} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="confirm"
            placeholder="Type RESET to confirm"
            autoComplete="off"
            className="max-w-[220px] rounded-md border px-2 py-1.5 text-sm"
          />
          <SubmitButton pendingLabel="Resetting…" variant="destructive">Reset all tasks</SubmitButton>
        </form>
      </section>
    </div>
  );
}
