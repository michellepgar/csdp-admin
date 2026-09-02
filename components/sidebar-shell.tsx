"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_NAME = "sidebar-collapsed";

/* Wraps the app's sidebar + main-content layout. `sidebar` is already
   server-rendered JSX (the caller passes <Sidebar .../> straight
   through) — this component only decides whether to show it, it
   never constructs it itself. `initialCollapsed` comes from a cookie
   read server-side in app/(app)/layout.tsx, so this component's first
   client render always matches what the server already sent — no
   flash of the sidebar before it collapses, unlike a
   useEffect+localStorage approach would cause.

   The toggle button is fixed in the same screen position (top-left)
   whether the sidebar is shown or hidden, so it's always exactly
   where you last clicked it. */
export function SidebarShell({
  sidebar,
  initialCollapsed,
  children,
}: {
  sidebar: React.ReactNode;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-screen">
      {!collapsed && sidebar}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        className="fixed top-4 left-4 z-20 border bg-background"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
