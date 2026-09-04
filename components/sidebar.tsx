"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  School,
  Users,
  MessageSquarePlus,
  Megaphone,
  Lock,
  Mail,
  Contact,
  Clock,
  DatabaseBackup,
  AlertTriangle,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { SCHOOL_GROUPS, type Va } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { IconTooltip } from "@/components/icon-tooltip";
import { SignOutButton } from "@/components/sign-out-button";
import { SchoolsFlyout } from "@/components/schools-flyout";

export function Sidebar({
  currentName,
  schools,
  isAdmin,
  vas,
  schoolVaAssigned,
  addSchool,
  onCollapse,
  collapsed = false,
}: {
  currentName: string;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
  vas: Va[];
  /* schoolId -> assigned VA's name, derived from state.schoolData
     upstream (schoolData itself isn't relational -- see
     lib/app-state.ts's SchoolDataEntry comment -- so this is computed
     once in app/(app)/layout.tsx rather than passing the whole blob
     down here). */
  schoolVaAssigned: Record<string, string>;
  addSchool: (formData: FormData) => void;
  onCollapse: () => void;
  /* Icons-only mode -- Michelle asked to be able to jump between
     pages without the full labeled panel taking up space every time.
     Search/VA-filter/"+ Add school" all need room to type in, so
     those (and every text label) just disappear rather than trying
     to cram them into a 4rem-wide column; the school and nav icons
     stay clickable, with the label available as a native title
     tooltip on hover. Mobile ignores this entirely -- its overlay is
     already only on-screen when explicitly opened, so there's no
     "always visible, wastes space" problem for it to solve (see
     components/sidebar-shell.tsx). */
  collapsed?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [vaFilter, setVaFilter] = useState("");
  const [addingSchool, setAddingSchool] = useState(false);
  const pathname = usePathname();

  const colorByVaName = new Map(vas.filter((v) => v.color).map((v) => [v.name, v.color as string]));

  // Every plain nav link below (not the school list or Sign out, which
  // have their own look) shares this same "am I the current page"
  // class, so the selected-item look (--sidebar-accent background,
  // --sidebar-accent-foreground text -- its own deeper teal, not just
  // the ordinary --foreground) shows up identically wherever the
  // visitor actually is, without repeating the isActive check and its
  // resulting className at each of the ~10 call sites.
  const navLinkClass = (href: string, extra: string) =>
    cn(
      "flex min-w-0 items-center rounded-md py-2 text-sm font-medium",
      pathname === href ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "hover:bg-muted",
      extra,
    );

  // Only rendered in expanded mode now -- collapsed mode shows a
  // single SchoolsFlyout icon instead (its own search box lives
  // inside that flyout).
  const filteredSchools = [...schools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => !vaFilter || schoolVaAssigned[s.id] === vaFilter);

  return (
    <aside className={cn("flex flex-none flex-col border-r bg-sidebar transition-[width]", collapsed ? "w-16" : "w-64")}>
      {/* bg-header-background + text-white -- Michelle asked for the
          header bar's color to reach all the way over into the
          sidebar's own top corner too, not stop at its right edge.
          text-white on the row itself (not just the logo) so the
          theme-toggle/collapse icons inherit a color that actually
          contrasts, same reasoning as h1's own white text against
          this background elsewhere. h-16 (not p-4, which sized this
          block to its own content) matches every page header's own
          fixed height (see components/page-header.tsx's comment) so
          this corner lines up with whichever one is showing instead
          of drifting a few px off depending on font metrics. */}
      <div className={cn("flex h-16 items-center bg-header-background px-4 text-white", collapsed ? "justify-center" : "justify-between gap-2")}>
        {!collapsed && (
          <div>
            <div className="text-lg font-bold">CSDP Tracker</div>
            {/* Plain white, no VA color here -- a background pill
                behind the color-tinted name was tried first, but
                Michelle said it still wasn't reliably readable (some
                VA colors are just too pale against teal no matter
                what sits behind them). This is the one spot that only
                needs to answer "whose account is this," so it doesn't
                need the color-coding every other name in the app
                uses -- plain white always reads clearly here. */}
            <div className="mt-1 text-sm text-white/80">{currentName}</div>
          </div>
        )}
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-1")}>
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCollapse}
            aria-label={collapsed ? "Show full sidebar" : "Collapse sidebar to icons"}
            title={collapsed ? "Show full sidebar" : "Collapse to icons"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {/* Bigger and bolder than every other nav link on purpose -- this
            is the home/dashboard link, Michelle asked for it to stand
            out from the rest of the list below it. */}
        {/* prefetch={false} on every nav link below: Next.js prefetches
            every Link visible in the viewport by default, and this
            sidebar shows all ~11 of them at once on every single page
            load -- each one is a fully dynamic, auth-gated page that
            still has to run its own real backend fetch to prefetch
            anything useful, so that default was quietly firing off ~11
            extra full page loads in the background on every navigation,
            competing with the actual page for the browser's connection
            pool. Confirmed directly in the Network tab: every sidebar
            link showing its own `?_rsc=` fetch, most matching times
            similar to what a real navigation is trying to run its
            course.  Clicking a link still navigates instantly either
            way -- prefetch only removes a head start that was costing
            more than it was worth here. */}
        <IconTooltip label="Overview" active={collapsed}>
          <Link
            href="/overview"
            prefetch={false}
            className={cn(
              "flex items-center rounded-md py-2.5 text-base font-bold",
              pathname === "/overview" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-muted",
              collapsed ? "justify-center px-2" : "gap-2 px-3",
            )}
          >
            <LayoutDashboard className="h-5 w-5 flex-none text-cyan-600 dark:text-cyan-400" />
            {!collapsed && "Overview"}
          </Link>
        </IconTooltip>

        {!collapsed && (
          <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">
            Schools ({schools.length})
          </div>
        )}
        {!collapsed && (
          <div className="space-y-2 px-3 py-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schools…"
              className="h-8 text-sm"
            />
            <Dropdown
              name="vaFilter"
              value={vaFilter}
              onChange={setVaFilter}
              placeholder="All VAs"
              options={[{ value: "", label: "All VAs" }, ...[...vas].sort((a, b) => a.name.localeCompare(b.name)).map((v) => ({ value: v.name, label: v.name }))]}
              className="w-full rounded-md border px-2 py-1.5 text-left text-sm"
            />
          </div>
        )}
        {collapsed ? (
          // One icon standing in for the whole list -- with 20+
          // schools, a wall of identical School icons (one per school,
          // the previous approach) needed its own inner scrollbar and
          // told you nothing until you'd already opened the sidebar
          // back up. Hovering this one reveals the full list (with its
          // own search box) in a flyout instead.
          <div className="mt-2 flex justify-center">
            <SchoolsFlyout schools={schools} colorByVaName={colorByVaName} schoolVaAssigned={schoolVaAssigned} />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto px-1">
            {filteredSchools.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No schools match.</p>
            ) : (
              filteredSchools.map((s) => {
                const vaName = schoolVaAssigned[s.id];
                const color = vaName ? colorByVaName.get(vaName) : undefined;
                return (
                  <Link
                    key={s.id}
                    href={`/schools/${s.id}`}
                    prefetch={false}
                    title={s.name}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm",
                      pathname === `/schools/${s.id}` ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "hover:bg-muted",
                    )}
                    style={color ? { color } : undefined}
                  >
                    <School className="h-4 w-4 flex-none" />
                    <span className="min-w-0 truncate">{s.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        )}
        {!collapsed &&
          (addingSchool ? (
            <form
              action={addSchool}
              onSubmit={() => setAddingSchool(false)}
              className="mx-2 mt-1 space-y-2 rounded-md border p-2"
            >
              <Input name="name" placeholder="School name" required autoFocus className="h-8 text-sm" />
              <Dropdown
                name="groupName"
                placeholder="No group (add later)"
                options={SCHOOL_GROUPS.map((g) => ({ value: g, label: g }))}
                className="w-full rounded-md border px-2 py-1.5 text-left text-sm"
              />
              <div className="flex items-center gap-1">
                <SubmitButton pendingLabel="…" size="sm">Add</SubmitButton>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingSchool(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSchool(true)}
              className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              + Add school
            </button>
          ))}

        {!collapsed && <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">My Space</div>}
        <IconTooltip label="Private Notes" active={collapsed}>
          <Link
            href="/private-notes"
            prefetch={false}
            title={!collapsed ? "Private Notes" : undefined}
            className={navLinkClass("/private-notes", collapsed ? "mt-4 justify-center px-2" : "gap-2 px-3")}
          >
            <Lock className="h-4 w-4 flex-none text-violet-600 dark:text-violet-400" />
            {!collapsed && <span className="min-w-0 truncate">Private Notes</span>}
          </Link>
        </IconTooltip>

        {!collapsed && <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">Resources</div>}
        <IconTooltip label="General Notes" active={collapsed}>
          <Link
            href="/notes"
            prefetch={false}
            title={!collapsed ? "General Notes" : undefined}
            className={navLinkClass("/notes", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <Megaphone className="h-4 w-4 flex-none text-amber-600 dark:text-amber-400" />
            {!collapsed && <span className="min-w-0 truncate">General Notes</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="Issues & Concerns" active={collapsed}>
          <Link
            href="/issues"
            prefetch={false}
            title={!collapsed ? "Issues & Concerns" : undefined}
            className={navLinkClass("/issues", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <AlertTriangle className="h-4 w-4 flex-none text-red-600 dark:text-red-400" />
            {!collapsed && <span className="min-w-0 truncate">Issues & Concerns</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="EOD Reports" active={collapsed}>
          <Link
            href="/eod"
            prefetch={false}
            title={!collapsed ? "EOD Reports" : undefined}
            className={navLinkClass("/eod", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <Clock className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400" />
            {!collapsed && <span className="min-w-0 truncate">EOD Reports</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="Schools Contact Information" active={collapsed}>
          <Link
            href="/contacts"
            prefetch={false}
            title={!collapsed ? "Schools Contact Information" : undefined}
            className={navLinkClass("/contacts", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <Contact className="h-4 w-4 flex-none text-teal-600 dark:text-teal-400" />
            {!collapsed && <span className="min-w-0 truncate">Schools Contact Information</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="Distribution List" active={collapsed}>
          <Link
            href="/distribution-list"
            prefetch={false}
            title={!collapsed ? "Distribution List" : undefined}
            className={navLinkClass("/distribution-list", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <Send className="h-4 w-4 flex-none text-indigo-600 dark:text-indigo-400" />
            {!collapsed && <span className="min-w-0 truncate">Distribution List</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="Email Templates" active={collapsed}>
          <Link
            href="/templates"
            prefetch={false}
            title={!collapsed ? "Email Templates" : undefined}
            className={navLinkClass("/templates", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <Mail className="h-4 w-4 flex-none text-sky-600 dark:text-sky-400" />
            {!collapsed && <span className="min-w-0 truncate">Email Templates</span>}
          </Link>
        </IconTooltip>
        <IconTooltip label="Suggestions" active={collapsed}>
          <Link
            href="/suggestions"
            prefetch={false}
            title={!collapsed ? "Suggestions" : undefined}
            className={navLinkClass("/suggestions", collapsed ? "justify-center px-2" : "gap-2 px-3")}
          >
            <MessageSquarePlus className="h-4 w-4 flex-none text-fuchsia-600 dark:text-fuchsia-400" />
            {!collapsed && <span className="min-w-0 truncate">Suggestions</span>}
          </Link>
        </IconTooltip>

        {isAdmin && (
          <>
            {!collapsed && <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">Admin</div>}
            <IconTooltip label="Team" active={collapsed}>
              <Link
                href="/team"
                prefetch={false}
                title={!collapsed ? "Team" : undefined}
                className={navLinkClass("/team", collapsed ? "mt-4 justify-center px-2" : "gap-2 px-3")}
              >
                <Users className="h-4 w-4 flex-none text-orange-600 dark:text-orange-400" />
                {!collapsed && <span className="min-w-0 truncate">Team</span>}
              </Link>
            </IconTooltip>
            <IconTooltip label="Backup & School Year" active={collapsed}>
              <Link
                href="/admin-settings"
                prefetch={false}
                title={!collapsed ? "Backup & School Year" : undefined}
                className={navLinkClass("/admin-settings", collapsed ? "justify-center px-2" : "gap-2 px-3")}
              >
                <DatabaseBackup className="h-4 w-4 flex-none text-rose-600 dark:text-rose-400" />
                {!collapsed && <span className="min-w-0 truncate">Backup & School Year</span>}
              </Link>
            </IconTooltip>
          </>
        )}

        {!collapsed && <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">Account</div>}
        <div className={collapsed ? "mt-4" : undefined}>
          <SignOutButton collapsed={collapsed} />
        </div>
      </nav>
    </aside>
  );
}
