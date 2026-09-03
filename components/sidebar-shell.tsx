"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
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
          reliably supported everywhere.

          Desktop's "collapsed" no longer removes the sidebar from
          view (md:hidden + a floating re-open button) -- Michelle
          asked to be able to jump between pages without re-opening
          the full panel every time, so it now stays on screen at a
          narrow icon-only width instead (Sidebar's own `collapsed`
          prop controls that). Always `md:flex` here as a result;
          there's no longer a "fully gone" desktop state that needs a
          separate way back in. Mobile is untouched -- it's an overlay
          that's already only on screen when explicitly opened via the
          hamburger below, so `collapsed` doesn't apply to it at all. */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-0 md:z-auto md:flex md:h-screen md:translate-x-0 md:overflow-y-auto md:transition-none`}
      >
        <Sidebar
          currentName={currentName}
          schools={schools}
          isAdmin={isAdmin}
          vas={vas}
          schoolVaAssigned={schoolVaAssigned}
          addSchool={addSchool}
          onCollapse={handleSidebarHide}
          collapsed={collapsed}
        />
      </div>

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

          No padding here at all, and min-w-0 -- both on purpose. Every
          page's own sticky header bar needs to span main's full width
          with no gap around it, which used to be done with a
          negative-margin trick matching whatever padding main had at
          each breakpoint. That's exactly the kind of thing that goes
          quietly wrong the moment the two drift out of sync (as they
          did here), so padding moved to a wrapper INSIDE each page
          instead, around everything except its header -- the header
          just naturally spans main's real width, no arithmetic
          required. min-w-0 fixes a separate real bug this surfaced:
          a flex item's default min-width is "auto", meaning a wide
          enough descendant (e.g. Contacts' table, min-w-[900px])
          could force main itself wider than its fair share of the
          row, squeezing the sidebar -- min-w-0 lets main shrink to
          its actual allotted space and leaves overflow-x-auto
          wrappers deeper in the tree to handle their own overflow, as
          intended. The floating "show sidebar" buttons below no
          longer need reserved top padding either -- they now simply
          float on top of the header bar, which starts at main's very
          top edge.

          The inner div exists only to key page transitions -- Michelle
          asked for some effect when a new page opens, sliding in from
          the sidebar's side (left) rather than rising up from below.
          `key={pathname}` makes React unmount/remount this div on
          every route change (even between two pages that'd otherwise
          render structurally similar JSX), which restarts the fade/
          slide animation from scratch each time instead of it only
          playing once ever. A longer duration (500ms) with a
          decelerate-then-settle curve (an "ease-out-quint" shape, not
          Tailwind's built-in ease-out, which cuts off more abruptly)
          reads as smoother than the original snappier 300ms version --
          confirmed directly by comparing both mid-animation. */}
      <main className="min-w-0 flex-1">
        <div
          key={pathname}
          className="animate-in fade-in slide-in-from-left-3 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
