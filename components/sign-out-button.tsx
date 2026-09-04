"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { HoverLabel } from "@/components/hover-label";

/* Same sign-out logic app/not-on-team/page.tsx already used, just
   reachable from inside the app now too -- there was previously no
   way to sign out once actually on a team page, only from that one
   dead-end screen. Styled to match the sidebar's own nav links
   (components/sidebar.tsx) rather than using the shared Button
   component, so it sits in that list looking like one more item
   rather than a visually distinct control. */
export function SignOutButton({ collapsed }: { collapsed: boolean }) {
  async function signOut() {
    // Clearing this unconditionally is harmless for a real account (the
    // cookie was never set) and is what actually ends a demo session --
    // the demo user has no real Supabase session for signOut() below to
    // touch, so without this the demo-mode cookie would just log them
    // straight back into the demo on their next visit to /login.
    document.cookie = "demo-mode=; path=/; max-age=0";
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const button = (
    <button
      type="button"
      onClick={signOut}
      className={cn(
        "flex w-full items-center rounded-md py-2 text-sm font-medium hover:bg-muted",
        collapsed ? "justify-center px-2" : "gap-2 px-3",
      )}
    >
      <LogOut className="h-4 w-4 flex-none text-slate-600 dark:text-slate-400" />
      {!collapsed && "Sign out"}
    </button>
  );

  return collapsed ? (
    <HoverLabel label="Sign out" className="w-full">
      {button}
    </HoverLabel>
  ) : (
    button
  );
}
