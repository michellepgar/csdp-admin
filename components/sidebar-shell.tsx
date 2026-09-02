"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import type { Va } from "@/lib/app-state";

const COOKIE_NAME = "sidebar-collapsed";
/* Tailwind's default "md" breakpoint -- kept in sync with the md:
   classes below so the click-driven collapse/close logic matches
   whichever layout mode the CSS is actually rendering. */
const DESKTOP_BREAKPOINT_QUERY = "(min-width: 768px)";

/* Renders Sidebar directly (rather than receiving it pre-rendered as
   a ReactNode, like before) because Sidebar's own inline collapse
   button needs to call back into this component's toggle() -- a
   client callback can't cross the server->client boundary as part of
   pre-rendered JSX, so the caller (app/(app)/layout.tsx) now passes
   Sidebar's plain data props through this component instead.

   Below the md breakpoint, the sidebar becomes an off-canvas overlay
   (fixed, slid in/out with a backdrop) instead of pushing <main> --
   on a phone-width screen a permanently-docked 256px sidebar leaves
   too little room to see page content without scrolling sideways.
   Desktop keeps its existing push/collapse behavior, persisted via
   the sidebar-collapsed cookie; mobile's open/closed state is
   separate, always starts closed, and isn't persisted. */
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes (tapping a nav link).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isDesktopViewport() {
    return typeof window !== "undefined" && window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
  }

  function toggleDesktopCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Sidebar's own "Hide sidebar" button is shared between both modes --
  // route it based on the viewport actually active when it's clicked.
  function handleSidebarHide() {
    if (isDesktopViewport()) {
      toggleDesktopCollapsed();
    } else {
      setMobileOpen(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* On desktop the sidebar is "sticky" to the viewport and
          scrolls its own overflow internally, rather than <main>
          being the scrollable element -- position:sticky on a page's
          h1 is anchored to whichever ancestor actually scrolls, and
          nested-overflow scroll containers are exactly the case
          mobile Safari (and some older WebKit) handles unreliably for
          sticky positioning. Letting the document/body scroll
          normally, like a plain page, is the one case sticky is
          reliably supported everywhere. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:overflow-y-auto md:transition-none ${collapsed ? "md:hidden" : "md:flex"}`}
      >
        <Sidebar
          currentName={currentName}
          schools={schools}
          isAdmin={isAdmin}
          vas={vas}
          schoolVaAssigned={schoolVaAssigned}
          addSchool={addSchool}
          onCollapse={handleSidebarHide}
        />
      </div>

      {collapsed && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggleDesktopCollapsed}
          aria-label="Show sidebar"
          className="fixed top-4 left-4 z-20 hidden border bg-background md:flex"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}

      {!mobileOpen && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Show sidebar"
          className="fixed top-4 left-4 z-20 border bg-background md:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      {/* No overflow-y-auto here on purpose -- see the comment on the
          sidebar wrapper above. The document itself scrolls; this is
          just a normal flex-1 block.
          Longhand padding per side and breakpoint, not the shorthand
          "p" / "pt" utilities, so the mobile top padding reserved for
          the hamburger button above can't be silently overridden by a
          same-breakpoint shorthand utility. */}
      <main
        className={`flex-1 pt-14 pr-4 pb-4 pl-4 sm:pt-16 sm:pr-6 sm:pb-6 sm:pl-6 md:pt-8 md:pr-8 md:pb-8 md:pl-8 ${
          collapsed ? "md:pt-12 md:pl-12" : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
