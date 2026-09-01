import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canEditSchoolRecords, type AccessRequest, type AppState } from "@/lib/app-state";
import { SubmitButton } from "@/components/submit-button";
import { approveAccessRequest, declineAccessRequest, deleteAccessRequestRow } from "./actions";

function fmtDateTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = { pending: "Pending", declined: "Declined", fulfilled: "Done" };

function RequestRow({ state, req, showApproveDecline }: { state: AppState; req: AccessRequest; showApproveDecline: boolean }) {
  const school = state.schools.find((s) => s.id === req.schoolId);
  const sd = state.schoolData[req.schoolId];

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm">
          <strong>{req.requestedBy}</strong> wants to remove: {req.label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {school ? school.name : "Unknown school"} · {sd && sd.vaAssigned ? `Assigned to ${sd.vaAssigned}` : "Unassigned"} · {fmtDateTime(req.createdAt)}
        </p>
        <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
        {req.resolvedBy && (
          <p className="text-xs text-muted-foreground">
            {req.status === "fulfilled" ? "Approved and removed" : "Declined"} by {req.resolvedBy}
            {req.resolvedAt ? ` · ${fmtDateTime(req.resolvedAt)}` : ""}
          </p>
        )}
      </div>
      {showApproveDecline ? (
        <div className="flex flex-none gap-2">
          <form action={approveAccessRequest}>
            <input type="hidden" name="id" value={req.id} />
            <SubmitButton pendingLabel="…">✅ Approve</SubmitButton>
          </form>
          <form action={declineAccessRequest}>
            <input type="hidden" name="id" value={req.id} />
            <SubmitButton pendingLabel="…" variant="destructive">❌ Decline</SubmitButton>
          </form>
        </div>
      ) : (
        <div className="flex flex-none items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[req.status] || req.status}</span>
          <form action={deleteAccessRequestRow}>
            <input type="hidden" name="id" value={req.id} />
            <SubmitButton pendingLabel="…" variant="ghost" size="sm">
              {req.status === "pending" ? "Cancel" : "Delete"}
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const meIsAdmin = isAdmin(me);
  const all = state.accessRequests || [];

  const forMe = all
    .filter((r) => canEditSchoolRecords(state.schoolData[r.schoolId], me.name, meIsAdmin))
    .sort((a, b) => {
      if ((a.status === "pending") !== (b.status === "pending")) return a.status === "pending" ? -1 : 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  const forMePendingCount = forMe.filter((r) => r.status === "pending").length;

  const mine = all
    .filter((r) => r.requestedBy === me.name)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Approvals</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Requests for your schools {forMePendingCount > 0 && <span className="text-sm font-normal text-muted-foreground">({forMePendingCount})</span>}
        </h2>
        <div className="space-y-2">
          {forMe.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests for schools you manage.</p>
          ) : (
            forMe.map((r) => <RequestRow key={r.id} state={state} req={r} showApproveDecline={r.status === "pending"} />)
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your requests</h2>
        <div className="space-y-2">
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t requested access to anything.</p>
          ) : (
            mine.map((r) => <RequestRow key={r.id} state={state} req={r} showApproveDecline={false} />)
          )}
        </div>
      </section>
    </div>
  );
}
