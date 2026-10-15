"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onUserBack, tabInUse } from "@/lib/user-activity";

// Was 15s -- every firing re-runs the layout's own ~39-table Promise.all
// (see lib/fetch-app-state.ts) plus the current page's own query, for every
// tab anyone on the team has open, whether or not anything actually
// changed. 30s halves that background load (Michelle: "the tracker is kinda
// slow right now") while still keeping a page current well within a shift;
// coming back to a tab still refreshes right away (onReturn below) so it's
// never stale for longer than that on return.
// Now 60s, and paused while nobody is using the tab (lib/user-activity.ts):
// each refresh costs server CPU time on Vercel, which is limited on the plan.
// The notification bell still pulls in new assignments sooner.
// Now 3 minutes: on Cloudflare's free plan every refresh re-renders the whole
// page on the server, and this was most of the app's background work.
const INTERVAL_MS = 180_000;
// Coming back to the tab refreshes right away, but at most once a minute:
// switching tabs fires several "you're back" events at once, and each one
// used to re-render the whole page on the server.
const RETURN_GAP_MS = 60_000;

/* Keeps the page current with what teammates are doing, without anyone
   pressing refresh: every few seconds while the tab is visible (and the
   moment you come back to it) it quietly re-reads the page's data. Client
   state -- what you've typed, which window is open -- is left alone.

   It skips a beat while you're typing in a field or have a window open, so a
   refresh never lands in the middle of what you're doing. */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    function busy(): boolean {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        const typingType = tag === "INPUT" && !["checkbox", "radio", "button", "submit", "range", "color"].includes((active as HTMLInputElement).type);
        if (typingType || tag === "TEXTAREA" || active.isContentEditable) return true;
      }
      return !!document.querySelector('[role="dialog"]');
    }

    function refresh() {
      if (!tabInUse() || busy()) return;
      last = Date.now();
      router.refresh();
    }

    function onReturn() {
      if (Date.now() - last > RETURN_GAP_MS) refresh();
    }

    // The timer skips a beat when coming back to the tab just refreshed it.
    function onTimer() {
      if (Date.now() - last >= INTERVAL_MS / 2) refresh();
    }

    const timer = setInterval(onTimer, INTERVAL_MS);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    const stopBack = onUserBack(onReturn);
    return () => {
      clearInterval(timer);
      stopBack();
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [router]);

  return null;
}
