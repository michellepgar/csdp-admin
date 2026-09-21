"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* A titled section that folds away, remembering whether you left it open or
   closed (a cookie, so the server renders it the right way from the first
   paint -- no flash of it open before it collapses). The body stays mounted
   while hidden, so anything inside keeps its own state. */
export function CollapsibleSection({
  title,
  count,
  initialCollapsed,
  cookieName,
  children,
}: {
  title: string;
  count?: number;
  initialCollapsed: boolean;
  cookieName: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${cookieName}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <section>
      <h2>
        <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex w-full items-center gap-2 text-left">
          <ChevronDown className={cn("h-4 w-4 flex-none transition-transform", collapsed && "-rotate-90")} />
          <span>{title}</span>
          {!!count && <span className="rounded-full bg-white/25 px-2 text-xs font-semibold">{count}</span>}
          <span className="ml-auto text-xs font-normal text-white/80">{collapsed ? "Show" : "Hide"}</span>
        </button>
      </h2>
      <div hidden={collapsed} className="pt-2">
        {children}
      </div>
    </section>
  );
}
