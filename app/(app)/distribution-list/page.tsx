import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { DistributionList } from "@/components/distribution-list";
import {
  addDistributionGroup,
  renameDistributionGroup,
  removeDistributionGroup,
  addDistributionRow,
  updateDistributionRow,
  removeDistributionRow,
} from "./actions";

export default async function DistributionListPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Distribution List</h1>
      <DistributionList
        groups={state.distributionGroups || []}
        addDistributionGroup={addDistributionGroup}
        renameDistributionGroup={renameDistributionGroup}
        removeDistributionGroup={removeDistributionGroup}
        addDistributionRow={addDistributionRow}
        updateDistributionRow={updateDistributionRow}
        removeDistributionRow={removeDistributionRow}
      />
    </div>
  );
}
