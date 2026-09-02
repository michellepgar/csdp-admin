"use client";

import { useState } from "react";
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
  ShieldAlert,
  CheckSquare,
  AlertTriangle,
  Send,
  PanelLeftClose,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SCHOOL_GROUPS, type Va } from "@/lib/app-state";

export function Sidebar({
  currentName,
  schools,
  isAdmin,
  vas,
  schoolVaAssigned,
  addSchool,
  onCollapse,
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
}) {
  const [search, setSearch] = useState("");
  const [vaFilter, setVaFilter] = useState("");
  const [addingSchool, setAddingSchool] = useState(false);

  const colorByVaName = new Map(vas.filter((v) => v.color).map((v) => [v.name, v.color as string]));
  const myColor = colorByVaName.get(currentName);

  const filteredSchools = [...schools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => !vaFilter || schoolVaAssigned[s.id] === vaFilter);

  return (
    <aside className="flex w-64 flex-none flex-col border-r bg-background">
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <div>
          <div className="text-lg font-bold text-primary">CSDP Tracker</div>
          <div className="mt-1 text-sm text-muted-foreground" style={myColor ? { color: myColor } : undefined}>
            {currentName}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Hide sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <Link href="/overview" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </Link>

        <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">
          Schools ({schools.length})
        </div>
        <div className="space-y-2 px-3 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search schools…"
            className="h-8 text-sm"
          />
          <select
            value={vaFilter}
            onChange={(e) => setVaFilter(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">All VAs</option>
            {[...vas].sort((a, b) => a.name.localeCompare(b.name)).map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
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
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                  style={color ? { color } : undefined}
                >
                  <School className="h-4 w-4" />
                  {s.name}
                </Link>
              );
            })
          )}
        </div>
        {addingSchool ? (
          <form
            action={addSchool}
            onSubmit={() => setAddingSchool(false)}
            className="mx-2 mt-1 space-y-2 rounded-md border p-2"
          >
            <Input name="name" placeholder="School name" required autoFocus className="h-8 text-sm" />
            <select name="groupName" defaultValue="" className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">No group (add later)</option>
              {SCHOOL_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
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
        )}

        <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">My Space</div>
        <Link href="/private-notes" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Lock className="h-4 w-4" />
          Private Notes
        </Link>
        <Link href="/approvals" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <CheckSquare className="h-4 w-4" />
          Approvals
        </Link>

        <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">Resources</div>
        <Link href="/notes" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Megaphone className="h-4 w-4" />
          General Notes/Announcements
        </Link>
        <Link href="/issues" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <AlertTriangle className="h-4 w-4" />
          Issues &amp; Concerns
        </Link>
        <Link href="/eod" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Clock className="h-4 w-4" />
          EOD Reports
        </Link>
        <Link href="/contacts" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Contact className="h-4 w-4" />
          Schools Contact Information
        </Link>
        <Link href="/distribution-list" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Send className="h-4 w-4" />
          Distribution List
        </Link>
        <Link href="/templates" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <Mail className="h-4 w-4" />
          Email Templates
        </Link>
        <Link href="/suggestions" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
          <MessageSquarePlus className="h-4 w-4" />
          Suggestions
        </Link>

        {isAdmin && (
          <>
            <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">Admin</div>
            <Link href="/team" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
              <Users className="h-4 w-4" />
              Team
            </Link>
            <Link
              href="/admin-settings"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <ShieldAlert className="h-4 w-4" />
              Backup &amp; School Year
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
