import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // api/cron/* (the scheduler) and api/hq/* (Michelle HQ's read-only window) have no session; each guards itself with its own secret.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/hq|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
