import type { ShiftState } from "@/lib/app-state";

/* The daily workflow: Start my day -> (work) -> End Today's Work -> Start
   my day ... The two buttons keep each other honest: you can't start a
   day you are already in, and you can't end one you never started.

   A shift left open from an EARLIER calendar date (someone forgot to end
   it) counts as over, so Start my day never stays locked the next
   morning. End Today's Work stays available for as long as the shift is
   open, so a shift that runs past midnight can still be ended. */

// The whole team works Eastern -- same zone lib/shared-task-files.ts uses
// for "today".
const TEAM_TIME_ZONE = "America/New_York";

function calendarDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export interface ShiftAvailability {
  canStart: boolean;
  canEnd: boolean;
  /** Why Start my day is off (only set when canStart is false). */
  startHint?: string;
  /** Why End Today's Work is off (only set when canEnd is false). */
  endHint?: string;
}

export function shiftAvailability(states: ShiftState[] | undefined, vaName: string, now: Date = new Date()): ShiftAvailability {
  const mine = (states || []).find((s) => s.vaName === vaName);
  const working = mine?.status === "working";
  const stale = working && calendarDate(new Date(mine!.changedAt)) !== calendarDate(now);
  const canStart = !working || stale;
  const canEnd = working;
  return {
    canStart,
    canEnd,
    startHint: canStart ? undefined : "You're already in a shift. Click End Today's Work first.",
    endHint: canEnd ? undefined : "Click Start my day to begin a shift first.",
  };
}
