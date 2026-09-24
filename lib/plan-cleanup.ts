import type { AppState } from "@/lib/app-state";
import type { requireTeamMember } from "@/lib/require-team-member";

type Supabase = Awaited<ReturnType<typeof requireTeamMember>>["supabase"];

/* Once a task is being worked on or is finished, it no longer belongs in
   anyone's Your Plan / Planned Work: In Progress shows on Currently Working
   On instead, and Completed is done. (End Today's Work still carries
   unfinished In Progress tasks into tomorrow's plan, and a task planned
   after it was completed is a deliberate "review this" -- neither is touched.) */
export function statusLeavesPlan(status: string): boolean {
  return status === "In Progress" || status === "Completed";
}

type TaskRef = { taskFileCategoryId: string } | { generalTaskId: string };

/* Drops the task's plan items. A failure here never undoes the status
   change that triggered it -- the stale plan item can still be removed by hand. */
export async function clearTaskFromPlans(supabase: Supabase, ref: TaskRef) {
  const query = supabase.from("plan_items").delete().eq("kind", "task");
  const { error } =
    "taskFileCategoryId" in ref ? await query.eq("task_file_category_id", ref.taskFileCategoryId) : await query.eq("general_task_id", ref.generalTaskId);
  if (error) console.error("Couldn't clear the task from plans", error.message);
}

export function clearTaskFromPlansDemo(state: AppState, ref: TaskRef) {
  state.planItems = (state.planItems || []).filter(
    (p) => !(p.kind === "task" && ("taskFileCategoryId" in ref ? p.taskFileCategoryId === ref.taskFileCategoryId : p.generalTaskId === ref.generalTaskId)),
  );
}

