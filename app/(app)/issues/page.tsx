import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, CORRECTION_CATEGORIES, CORRECTION_KINDS } from "@/lib/app-state";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import {
  SoftwareIssueTable,
  RecordUpdateTable,
  CorrectionTable,
  ChartingTable,
} from "@/components/issues-list";
import {
  addSoftwareIssue,
  addRecordUpdate,
  addCorrection,
  addCharting,
  setIssueStatus,
  removeIssue,
  signIssueFix,
  removeIssueFixSignature,
} from "./actions";

export default async function IssuesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const meIsAdmin = isAdmin(me);
  const issues = state.issues || [];
  const software = issues.filter((i) => i.type === "software_issue");
  const recordUpdates = issues.filter((i) => i.type === "record_update");
  const corrections = issues.filter((i) => i.type === "correction");
  const charting = issues.filter((i) => i.type === "charting");

  const tableProps = { currentUserName: me.name, currentIsAdmin: meIsAdmin, setIssueStatus, removeIssue };
  const fixProps = { signIssueFix, removeIssueFixSignature };

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Issues &amp; Concerns</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Software Issue</h2>
        <form action={addSoftwareIssue} className="flex flex-wrap gap-2">
          <Input name="category" placeholder="Category (optional)" className="max-w-[200px]" />
          <Input name="description" placeholder="What's the issue?" required className="max-w-md flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
        <SoftwareIssueTable issues={software} {...tableProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Record Update</h2>
        <form action={addRecordUpdate} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input name="studentName" placeholder="Student Name" />
          <Input name="dob" type="date" placeholder="Date of Birth" />
          <Input name="insuranceNumber" placeholder="Insurance #" />
          <Input name="schoolYear" placeholder="School Year" />
          <Input name="fileName" placeholder="File Name" required />
          <Input name="pageNumber" placeholder="Page #" />
          <select name="correctingCategory" defaultValue="" className="rounded-md border px-2 py-1.5 text-sm">
            <option value="" disabled>Correcting…</option>
            {CORRECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input name="correctInfo" placeholder="Correct Info" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
        <RecordUpdateTable issues={recordUpdates} {...tableProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Correction / Verification</h2>
        <form action={addCorrection} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select name="correctionKind" defaultValue="Correction" className="rounded-md border px-2 py-1.5 text-sm">
              {CORRECTION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <Input name="studentRecordLink" placeholder="Link to student record" required className="max-w-md flex-1" />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground">Needs correction/verification:</span>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsNameCorrection" /> Name</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsDobCorrection" /> DOB</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsInsuranceCorrection" /> Insurance</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="needsOtherCorrection" /> Other</label>
            <Input name="otherCorrectionDetail" placeholder="What else needs correcting/verifying?" className="max-w-xs" />
          </div>
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
        <CorrectionTable issues={corrections} {...tableProps} {...fixProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Charting Questions</h2>
        <form action={addCharting} className="flex flex-wrap gap-2">
          <Input name="studentRecordLink" placeholder="Link to student record" required className="max-w-sm" />
          <Input name="question" placeholder="What's the question or concern?" required className="max-w-md flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
        <ChartingTable issues={charting} {...tableProps} {...fixProps} />
      </section>
    </div>
  );
}
