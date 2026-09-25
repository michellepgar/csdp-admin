"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* A thin bar across the top that starts the instant you click a link to
   another page and finishes when that page arrives -- so a click always
   answers right away, even while the next page is still loading. */
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [startedFrom, setStartedFrom] = useState<string | null>(null);

  // A click on a link to a different page of this app starts the bar.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setStartedFrom(window.location.pathname);
      setPhase("loading");
    }
    // Capture phase: a Next.js link marks the click as handled on its way
    // back up, so this listens on the way down instead.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The new page arrived: finish the bar, then hide it.
  useEffect(() => {
    if (phase !== "loading" || startedFrom === null || pathname === startedFrom) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reacting to the route change the click started.
    setPhase("done");
    const timer = setTimeout(() => setPhase("idle"), 300);
    return () => clearTimeout(timer);
  }, [pathname, phase, startedFrom]);

  // Never stay stuck if a navigation is cancelled.
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setTimeout(() => setPhase("idle"), 15_000);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5" aria-hidden="true">
      <div className={`h-full bg-primary shadow-[0_0_6px_var(--primary)] ${phase === "loading" ? "nav-progress-loading" : "w-full opacity-0 transition-opacity duration-300"}`} />
    </div>
  );
}
