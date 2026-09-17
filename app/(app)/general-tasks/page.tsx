import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { groupTaskTables } from "@/lib/shared-task-files";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { GeneralTasksList } from "@/components/general-tasks-list";
import { addTaskCategory } from "@/app/(app)/schools/[id]/actions";
import {
  addGeneralTask,
  setGeneralTaskStatus,
  signGeneralTask,
  removeVaFromGeneralTask,
  removeGeneralTask,
  addGeneralTaskCategory,
  removeGeneralTaskCategory,
  updateGeneralTaskDescription,
  moveGeneralTaskToSchool,
  moveGeneralTasksToSchool,
} from "./actions";

export default async function GeneralTasksPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  /* Per-school "table" shapes (a group of files sharing the same
     category set, same grouping the Tasks page itself uses) -- lets
     the move-to-school form offer "add to an existing table" without
     shipping every school's full file contents to the client. */
  const schoolTables = Object.fromEntries(
    state.schools.map((school) => [
      school.id,
      groupTaskTables(state.taskCategories || [], state.schoolData[school.id]?.taskFiles || []).map((t) => ({
        key: t.key,
        categoryIds: t.categories.map((c) => c.id),
        categoryNames: t.categories.map((c) => c.name),
        fileCount: t.files.length,
      })),
    ]),
  );

  return (
    <div>
      <PageHeader title="General Tasks" />
      <PageBody>
        <GeneralTasksList
          tasks={state.generalTasks || []}
          categories={state.generalTaskCategories || []}
          vas={state.vas}
          currentUserName={me.name}
          schools={state.schools}
          taskCategories={state.taskCategories || []}
          schoolTables={schoolTables}
          addGeneralTask={addGeneralTask}
          setGeneralTaskStatus={setGeneralTaskStatus}
          signGeneralTask={signGeneralTask}
          removeVaFromGeneralTask={removeVaFromGeneralTask}
          removeGeneralTask={removeGeneralTask}
          addGeneralTaskCategory={addGeneralTaskCategory}
          removeGeneralTaskCategory={removeGeneralTaskCategory}
          updateGeneralTaskDescription={updateGeneralTaskDescription}
          moveGeneralTaskToSchool={moveGeneralTaskToSchool}
          moveGeneralTasksToSchool={moveGeneralTasksToSchool}
          addTaskCategory={addTaskCategory}
        />
      </PageBody>
    </div>
  );
}
