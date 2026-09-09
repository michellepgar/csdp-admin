"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode, demoMutate } from "@/lib/demo-session";
import type { RedcapTally } from "@/lib/app-state";

function orThrow(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/* Called directly as plain functions from components/redcap-entry-form.tsx
   (a typed object, not FormData) -- same pattern as
   reorderChecklistTemplate in app/(app)/schools/[id]/actions.ts. The
   entry form's fields are all button-driven single/multi-select state,
   not native form controls, so there's no <form> for FormData to come
   from in the first place. */
export type RedcapTallyInput = {
  schoolId: string;
  schoolYear: string;
  grade: string;
  /** Student identity + visit tracking -- see RedcapTally's own
   *  comment in lib/app-state.ts for why these are all optional here
   *  too. The Add Student form (components/redcap-entry-form.tsx)
   *  requires studentName in its own validation before ever calling
   *  addRedcapTally/updateRedcapTally with it unset. */
  studentName?: string;
  dateOfBirth?: string;
  insuranceNumber?: string;
  seenInitialDate?: string;
  seenFollowUpDate?: string;
  insurance: string;
  dentalHomeStatus: string;
  referral: string;
  race: string;
  consent: string;
  fluoride: boolean;
  prophy: boolean;
  sealed1stMolar: boolean;
  sealed2ndMolar: boolean;
  needs: string[];
  /** Internal audit trail only -- see RedcapTally's own comment in
   *  lib/app-state.ts. */
  fileName?: string;
};

export async function addRedcapTally(input: RedcapTallyInput) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.redcapTallies ??= []).push({
        id: `demo-${Date.now()}`,
        ...input,
        enteredBy: "Jane",
        createdAt: new Date().toISOString(),
      });
    });
    revalidatePath("/redcap-report");
    return;
  }

  const { supabase, me } = await requireTeamMember();

  const { error } = await supabase.from("redcap_tallies").insert({
    id: crypto.randomUUID(),
    school_id: input.schoolId,
    school_year: input.schoolYear,
    grade: input.grade,
    student_name: input.studentName || null,
    date_of_birth: input.dateOfBirth || null,
    insurance_number: input.insuranceNumber || null,
    seen_initial_date: input.seenInitialDate || null,
    seen_follow_up_date: input.seenFollowUpDate || null,
    insurance: input.insurance,
    dental_home_status: input.dentalHomeStatus,
    referral: input.referral,
    race: input.race,
    consent: input.consent,
    fluoride: input.fluoride,
    prophy: input.prophy,
    sealed_1st_molar: input.sealed1stMolar,
    sealed_2nd_molar: input.sealed2ndMolar,
    needs: input.needs,
    entered_by: me.name,
    file_name: input.fileName || null,
  });
  orThrow(error);

  revalidatePath("/redcap-report");
}

export async function updateRedcapTally(id: string, input: RedcapTallyInput) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      const row = state.redcapTallies?.find((t) => t.id === id);
      if (row) Object.assign(row, input);
    });
    revalidatePath("/redcap-report");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase
    .from("redcap_tallies")
    .update({
      school_id: input.schoolId,
      school_year: input.schoolYear,
      grade: input.grade,
      student_name: input.studentName || null,
      date_of_birth: input.dateOfBirth || null,
      insurance_number: input.insuranceNumber || null,
      seen_initial_date: input.seenInitialDate || null,
      seen_follow_up_date: input.seenFollowUpDate || null,
      insurance: input.insurance,
      dental_home_status: input.dentalHomeStatus,
      referral: input.referral,
      race: input.race,
      consent: input.consent,
      fluoride: input.fluoride,
      prophy: input.prophy,
      sealed_1st_molar: input.sealed1stMolar,
      sealed_2nd_molar: input.sealed2ndMolar,
      needs: input.needs,
      file_name: input.fileName || null,
    })
    .eq("id", id);
  orThrow(error);

  revalidatePath("/redcap-report");
}

/* "Distributed" isn't derived from anything entered per-student --
   Michelle types this in directly per school/year/GRADE (see
   lib/app-state.ts's RedcapDistributedForms comment). Upsert since
   there's exactly one number per (school, year, grade): the first
   save creates the row, every save after that just overwrites it. */
export async function setRedcapDistributedForms(schoolId: string, schoolYear: string, grade: string, count: number) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      (state.redcapDistributedForms ??= {})[`${schoolId}:${schoolYear}:${grade}`] = count;
    });
    revalidatePath("/redcap-report");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase
    .from("redcap_distributed_forms")
    .upsert({ school_id: schoolId, school_year: schoolYear, grade, count, updated_at: new Date().toISOString() }, { onConflict: "school_id,school_year,grade" });
  orThrow(error);

  revalidatePath("/redcap-report");
}

export async function removeRedcapTally(id: string) {
  if (await isDemoMode()) {
    await demoMutate((state) => {
      state.redcapTallies = (state.redcapTallies || []).filter((t: RedcapTally) => t.id !== id);
    });
    revalidatePath("/redcap-report");
    return;
  }

  const { supabase } = await requireTeamMember();

  const { error } = await supabase.from("redcap_tallies").delete().eq("id", id);
  orThrow(error);

  revalidatePath("/redcap-report");
}
