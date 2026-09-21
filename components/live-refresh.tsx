"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 15_000;
const MIN_GAP_MS = 5_000;

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
      if (document.visibilityState !== "visible" || busy()) return;
      last = Date.now();
      router.refresh();
    }

    function onReturn() {
      if (Date.now() - last > MIN_GAP_MS) refresh();
    }

    const timer = setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [router]);

  return null;
}
