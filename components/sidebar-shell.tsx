"use client";

import { useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import type { Va } from "@/lib/app-state";

const COOKIE_NAME = "sidebar-collapsed";

/* Renders Sidebar directly (rather than receiving it pre-rendered as
   a ReactNode, like before) because Sidebar's own inline collapse
   button needs to call back into this component's toggle() -- a
   client callback can't cross the server->client boundary as part of
   pre-rendered JSX, so the caller (app/(app)/layout.tsx) now passes
   Sidebar's plain data props through this component instead. */
export function SidebarShell({
  currentName,
  schools,
  isAdmin,
  vas,
  schoolVaAssigned,
  addSchool,
  initialCollapsed,
  children,
}: {
  currentName: string;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
  vas: Va[];
  schoolVaAssigned: Record<string, string>;
  addSchool: (formData: FormData) => void;
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
    <div className="flex h-screen">
      {!collapsed && (
        <Sidebar
          currentName={currentName}
          schools={schools}
          isAdmin={isAdmin}
          vas={vas}
          schoolVaAssigned={schoolVaAssigned}
          addSchool={addSchool}
          onCollapse={toggle}
        />
      )}
      {collapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label="Show sidebar"
          className="fixed top-4 left-4 z-20 border bg-background"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}
      <main className={`min-h-0 flex-1 overflow-y-auto p-8 ${collapsed ? "pt-12 pl-12" : ""}`}>{children}</main>
    </div>
  );
}
