import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the shell renders one top bar with the sidebar toggle, and the sidebar sits under it", () => {
  const shell = readFileSync("components/sidebar-shell.tsx", "utf8");
  assert.match(shell, /<AppTopBar[\s\S]*onToggleSidebar=\{handleSidebarToggle\}/);
  assert.match(shell, /md:top-14/);
  const sidebar = readFileSync("components/sidebar.tsx", "utf8");
  assert.doesNotMatch(sidebar, /CSDP Tracker/);
  assert.doesNotMatch(sidebar, /<MentionsBell/);
});

test("the top bar has search (Ctrl/Cmd K), Quick add, notifications and the account menu", () => {
  const bar = readFileSync("components/app-top-bar.tsx", "utf8");
  assert.match(bar, /e\.ctrlKey \|\| e\.metaKey/);
  assert.match(bar, /<CommandPalette/);
  assert.match(bar, /<QuickAddDialog/);
  assert.match(bar, /setQuickAddOpen\(true\)/);
  assert.match(bar, /<MentionsBell[\s\S]*variant="topbar"/);
  assert.match(bar, /label="Account"/);
});

test("every page title row sticks under the top bar instead of at the very top", () => {
  for (const file of ["components/page-header.tsx", "app/(app)/overview/page.tsx", "app/(app)/schools/[id]/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /sticky top-14 z-10/, file);
    assert.doesNotMatch(source, /sticky top-0 z-10 flex[^"]*bg-header-background/, file);
  }
});

test("Quick add offers files, general tasks, private notes, issues and suggestions", () => {
  const dialog = readFileSync("components/quick-add-dialog.tsx", "utf8");
  for (const label of ["File", "General task", "Private note", "Issue", "Suggestion"]) assert.match(dialog, new RegExp(`label: "${label}"`));
  const layout = readFileSync("app/(app)/layout.tsx", "utf8");
  for (const action of ["addTask", "addGeneralTask", "addPrivateNote", "addIssue", "addSuggestion"]) assert.match(layout, new RegExp(`\\b${action},`));
});

test("the top bar search also finds private notes, and the Private Notes page filters by ?q=", () => {
  const palette = readFileSync("components/command-palette.tsx", "utf8");
  assert.match(palette, /searchNotes\(trimmed\)/);
  assert.match(palette, /highlightNote=\$\{hit\.id\}/);
  assert.match(readFileSync("app/(app)/layout.tsx", "utf8"), /searchNotes=\{searchPrivateNotes\}/);
  const page = readFileSync("components/private-notes-section.tsx", "utf8");
  assert.match(page, /noteMatches\(n\.text, words\)/);
  assert.match(page, /<NoteFocus id=\{highlightNote\}/);
  // The old address still works: it forwards to My Workspace's Private Notes tab.
  assert.match(readFileSync("app/(app)/private-notes/page.tsx", "utf8"), /redirect\(/);
});

test("the priority board sits above the notes list and folds away, remembered by a cookie", () => {
  const page = readFileSync("components/private-notes-section.tsx", "utf8");
  assert.ok(page.indexOf("<PrivateNotesBoard") < page.indexOf("<PrivateNotesList"));
  assert.match(page, /<CollapsibleSection title="My Priority Board"[^>]*cookieName="priority-board-collapsed"/);
  assert.match(readFileSync("components/collapsible-section.tsx", "utf8"), /document\.cookie = `\$\{cookieName\}=/);
});

test("a reminder in Your Plan is started (not checked off directly), same as a task", () => {
  const bubble = readFileSync("components/plan-bubble.tsx", "utf8");
  const start = bubble.indexOf("reminders.map");
  const reminders = bubble.slice(start, bubble.indexOf("myOpenEmailItems.length > 0", start));
  // Opening the reminder is just a link to the note...
  assert.match(reminders, /<Link href=\{`\/my-workspace\?tab=notes&highlightNote=\$\{item\.noteId\}`\}/);
  // ...and Start (not a direct "reviewed" checkbox) is what moves it to
  // Currently Working On, where it's completed instead -- matching a
  // task's own Start button on this same board.
  assert.match(reminders, /startReminder/);
  assert.match(reminders, /SubmitButton/);
  assert.doesNotMatch(reminders, /type="checkbox"/);
});
