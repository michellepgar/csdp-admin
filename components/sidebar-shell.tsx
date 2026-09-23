"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppTopBar } from "@/components/app-top-bar";
import type { QuickAddData } from "@/components/quick-add-dialog";
import type { PrivateNoteHit } from "@/app/(app)/private-notes/actions";
import { Sidebar } from "@/components/sidebar";
import { PlanBubble } from "@/components/plan-bubble";
import type { OpenEmailItem } from "@/lib/shared-task-files";
import type { PlanItem, TaskCategory, GeneralTaskCategory, Va, Mention, WorkNote } from "@/lib/app-state";
import type { CurrentPresenceMember } from "@/components/team-presence";

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
  currentMember,
  presenceEnabled,
  schools,
  isAdmin,
  vas,
  schoolVaAssigned,
  addSchool,
  initialCollapsed,
  needsPrivateNoteAck,
  needsGeneralNoteAck,
  needsIssueCommentAck,
  myMentions,
  markMentionRead,
  myPlanItems,
  myWorkNotes,
  myOpenEmailItems,
  taskCategories,
  generalTaskCategories,
  resolveTaskPlanItem,
  resolvePriorityPlanItem,
  startReminder,
  setEmailStatus,
  quickAdd,
  searchNotes,
  children,
}: {
  currentName: string;
  currentMember: CurrentPresenceMember;
  presenceEnabled: boolean;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
  vas: Va[];
  schoolVaAssigned: Record<string, string>;
  addSchool: (formData: FormData) => void;
  initialCollapsed: boolean;
  needsPrivateNoteAck: boolean;
  needsGeneralNoteAck: boolean;
  needsIssueCommentAck: boolean;
  myMentions: Mention[];
  markMentionRead: (formData: FormData) => void;
  myPlanItems: PlanItem[];
  myWorkNotes: WorkNote[];
  myOpenEmailItems: OpenEmailItem[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  resolveTaskPlanItem: (formData: FormData) => void;
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  startReminder: (formData: FormData) => Promise<{ error: string | null }>;
  setEmailStatus: (formData: FormData) => void;
  quickAdd: QuickAddData;
  searchNotes: (query: string) => Promise<PrivateNoteHit[]>;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes (tapping a nav link).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Navigation is the external event that must close the mobile drawer.
    setMobileOpen(false);
  }, [pathname]);

  // Restores each page's own scroll position when you land back on it --
  // the browser's real Back button already does this on its own
  // (confirmed directly), but clicking a normal link (sidebar nav, a
  // link from a card) to a page you'd already scrolled down on doesn't
  // count as "back" to the browser, so it always starts at the top.
  // Keying by pathname in sessionStorage means each page remembers its
  // own spot independently, and it's cleared when the tab closes.
  useEffect(() => {
    const key = `scroll:${pathname}`;
    const saved = sessionStorage.getItem(key);
    window.scrollTo(0, saved ? parseInt(saved, 10) : 0);

    // Deliberately NOT also saving on this effect's cleanup -- by the
    // time cleanup for the OUTGOING page runs, Next.js has already
    // navigated and window.scrollY already reflects the NEW page (0),
    // so a "final save" there overwrites the real position with 0
    // (confirmed directly: that's exactly what made the first version
    // of this fix not work). The live listener below already keeps
    // sessionStorage current as of the last real scroll on this page,
    // which is all that's needed.
    function saveScroll() {
      sessionStorage.setItem(key, String(window.scrollY));
    }
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => window.removeEventListener("scroll", saveScroll);
  }, [pathname]);

  function isDesktopViewport() {
    return typeof window !== "undefined" && window.matchMedia(DESKTOP_BREAKPOINT_QUERY).matches;
  }

  function toggleDesktopCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // The top bar's sidebar button is shared between both modes -- route it
  // based on the viewport actually active when it's clicked: shrink to
  // icons on desktop, open/close the drawer on a phone.
  function handleSidebarToggle() {
    if (isDesktopViewport()) {
      toggleDesktopCollapsed();
    } else {
      setMobileOpen((open) => !open);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppTopBar
        onToggleSidebar={handleSidebarToggle}
        sidebarCollapsed={collapsed}
        schools={schools}
        isAdmin={isAdmin}
        currentName={currentName}
        currentColor={currentMember.color}
        myMentions={myMentions}
        markMentionRead={markMentionRead}
        quickAdd={quickAdd}
        searchNotes={searchNotes}
      />

      <div className="flex flex-1">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* On desktop the sidebar is "sticky" under the top bar and scrolls
          its own overflow internally, rather than <main> being the
          scrollable element -- position:sticky on a page's title row is
          anchored to whichever ancestor actually scrolls, and
          nested-overflow scroll containers are exactly the case mobile
          Safari (and some older WebKit) handles unreliably for sticky
          positioning. Letting the document/body scroll normally, like a
          plain page, is the one case sticky is reliably supported
          everywhere.

          Desktop's "collapsed" keeps the sidebar on screen at a narrow
          icon-only width (Sidebar's own `collapsed` prop controls that),
          so you can jump between pages without re-opening the full panel.
          Mobile is an overlay that's only on screen when opened from the
          top bar's sidebar button; `collapsed` doesn't apply to it.
          overflow-y-auto (no breakpoint) lets a long nav scroll inside the
          drawer instead of running past the bottom of a phone screen. The
          top-14 offsets everywhere match the top bar's fixed h-14. */}
      <div
        className={`fixed bottom-0 left-0 top-14 z-40 overflow-y-auto transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:sticky md:top-14 md:z-auto md:flex md:h-[calc(100vh-3.5rem)] md:translate-x-0 md:transition-none`}
      >
        <Sidebar
          currentMember={currentMember}
          presenceEnabled={presenceEnabled}
          schools={schools}
          isAdmin={isAdmin}
          vas={vas}
          schoolVaAssigned={schoolVaAssigned}
          addSchool={addSchool}
          collapsed={collapsed}
          needsPrivateNoteAck={needsPrivateNoteAck}
          needsGeneralNoteAck={needsGeneralNoteAck}
          needsIssueCommentAck={needsIssueCommentAck}
        />
      </div>

      {/* No overflow-y-auto here on purpose -- see the comment on the
          sidebar wrapper above. The document itself scrolls; this is
          just a normal flex-1 block.

          No padding here at all, and min-w-0 -- both on purpose. Every
          page's own sticky title row needs to span main's full width
          with no gap around it, so padding lives in a wrapper INSIDE each
          page (components/page-body.tsx) around everything except that
          row. min-w-0 lets main shrink to its actual allotted space when
          a wide descendant (e.g. Contacts' table, min-w-[900px]) would
          otherwise force it wider than its share of the row and squeeze
          the sidebar; overflow-x-auto wrappers deeper in the tree handle
          their own overflow, as intended.

          Tried a page-open fade/slide effect here for a while --
          Michelle ended up preferring no transition at all, so this is
          plain, un-keyed content with no animation. */}
      <main className="min-w-0 flex-1">{children}</main>
      </div>

      <PlanBubble
        myWorkNotes={myWorkNotes}
        currentUserName={currentName}
        myPlanItems={myPlanItems}
        myOpenEmailItems={myOpenEmailItems}
        schools={schools}
        taskCategories={taskCategories}
        generalTaskCategories={generalTaskCategories}
        resolveTaskPlanItem={resolveTaskPlanItem}
        resolvePriorityPlanItem={resolvePriorityPlanItem}
        startReminder={startReminder}
        setEmailStatus={setEmailStatus}
      />
    </div>
  );
}
