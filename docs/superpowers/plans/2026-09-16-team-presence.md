# Team Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live, privacy-conscious online/idle team roster in the expanded and collapsed sidebar.

**Architecture:** A client-side `TeamPresence` component owns a private Supabase Realtime Presence subscription, local activity timing, and multi-tab aggregation. The existing app layout supplies the authenticated team member’s public display identity to the sidebar, which places the roster above Account and keeps the signed-in identity in Account.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase Realtime Presence, Supabase RLS, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-team-presence-design.md`

## Global Constraints

- Use throttled state transitions rather than frequent activity reporting.
- Do not persist user activity or expose email addresses.
- Keep the existing sidebar navigation, account controls, and sign-out behavior intact.
- Do not include the planned daily task overview in this feature.

---

## File Structure

- Create `lib/team-presence.ts`: payload validation, per-member tab aggregation, initials, and visible-roster helpers.
- Create `components/team-presence.tsx`: browser activity lifecycle, Presence subscription, roster rendering, and accessible avatar labels.
- Modify `components/sidebar.tsx`: mount the roster, remove the duplicated header identity, and show the Account identity at the bottom.
- Modify `components/sidebar-shell.tsx`: pass the current member’s ID, name, and color through to `Sidebar`.
- Modify `app/(app)/layout.tsx`: provide the authenticated member ID/color to the shell.
- Create `supabase/phase36_team_presence.sql`: authorize only team members for private `team-presence` broadcasts and Presence.
- Create `tests/team-presence.test.mts`: pure helper and sidebar-contract coverage.

### Task 1: Presence helpers and authorization migration

**Files:**
- Create: `lib/team-presence.ts`
- Create: `supabase/phase36_team_presence.sql`
- Test: `tests/team-presence.test.mts`

**Interfaces:**
- Produces `type PresencePayload`, `type TeamPresenceMember`, `aggregatePresence(state)`, `initialsForName(name)`, and `visiblePresence(members, limit)` for the client component.
- Produces the one-time SQL migration required before the deployed app may subscribe to `team-presence`.

- [ ] **Step 1: Write failing helper tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePresence, initialsForName, visiblePresence } from "../lib/team-presence";

test("groups multiple tabs for one member and keeps them active when any tab is active", () => {
  const members = aggregatePresence({
    tabA: [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", active: false, lastActiveAt: "2026-09-16T00:00:00.000Z" }],
    tabB: [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", active: true, lastActiveAt: "2026-09-16T00:01:00.000Z" }],
  });
  assert.deepEqual(members, [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", status: "active" }]);
});

test("rejects malformed payloads and caps the visible roster", () => {
  assert.deepEqual(aggregatePresence({ bad: [{ memberId: 7 }] }), []);
  assert.equal(visiblePresence(Array.from({ length: 6 }, (_, i) => ({ memberId: `${i}`, name: `VA ${i}`, color: "#000", status: "idle" as const })), 5).overflow, 1);
  assert.equal(initialsForName("Michelle Pink"), "MP");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --no-warnings --test tests/team-presence.test.mts`

Expected: FAIL because `lib/team-presence.ts` does not exist.

- [ ] **Step 3: Implement minimal typed helpers and the SQL authorization migration**

```ts
export function aggregatePresence(state: Record<string, PresencePayload[]>): TeamPresenceMember[] {
  // validate each payload, group by memberId, and choose active when one valid tab is active
}
```

```sql
create policy "team members can receive team presence"
on realtime.messages for select to authenticated
using (realtime.topic() = 'team-presence' and is_team_member());

create policy "team members can send team presence"
on realtime.messages for insert to authenticated
with check (realtime.topic() = 'team-presence' and is_team_member());
```

- [ ] **Step 4: Run helper tests**

Run: `node --no-warnings --test tests/team-presence.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit the helpers and migration**

```bash
git add lib/team-presence.ts supabase/phase36_team_presence.sql tests/team-presence.test.mts
git commit -m "feat: add private team presence foundation"
```

### Task 2: Client Presence lifecycle and sidebar roster

**Files:**
- Create: `components/team-presence.tsx`
- Modify: `components/sidebar.tsx`
- Test: `tests/team-presence.test.mts`

**Interfaces:**
- Consumes `aggregatePresence`, `initialsForName`, and `visiblePresence` from `lib/team-presence.ts`.
- Produces `TeamPresence({ currentMember, collapsed })` that takes `{ id: string; name: string; color?: string }`.

- [ ] **Step 1: Add failing sidebar-contract tests**

```ts
test("sidebar renders presence above Account and keeps the signed-in name out of the header", () => {
  const sidebar = readFileSync("components/sidebar.tsx", "utf8");
  assert.match(sidebar, /<TeamPresence[\s\S]*collapsed=\{collapsed\}/);
  assert.match(sidebar, /Online now[\s\S]*Account/);
  assert.doesNotMatch(sidebar, /mt-1 text-sm text-white\/80/);
});

test("presence renders a compact collapsed avatar stack", () => {
  const presence = readFileSync("components/team-presence.tsx", "utf8");
  assert.match(presence, /visiblePresence\(members, collapsed \? 3 : 5\)/);
  assert.match(presence, /aria-label=/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --no-warnings --test tests/team-presence.test.mts`

Expected: FAIL because the component is absent and `Sidebar` has the old header/account structure.

- [ ] **Step 3: Implement `TeamPresence`**

```tsx
const channel = createClient().channel("team-presence", {
  config: { presence: { key: tabKey }, private: true },
});

channel.on("presence", { event: "sync" }, () => setMembers(aggregatePresence(channel.presenceState())));
channel.subscribe(async (status) => {
  if (status === "SUBSCRIBED") await channel.track(payloadFor("active"));
});
```

Register `pointerdown`, `keydown`, `scroll`, `touchstart`, `focus`, and `visibilitychange` listeners. Reset a five-minute timer locally; only call `track()` when transitioning between active and idle. Remove listeners, timer, and channel in the effect cleanup.

- [ ] **Step 4: Mount it in the sidebar**

Remove the top header `currentName` text. Render `<TeamPresence currentMember={currentMember} collapsed={collapsed} />` immediately before the Account divider. Render `<currentName> · Signed in` within the expanded Account area and leave the existing Sign out control below it.

- [ ] **Step 5: Run the focused tests**

Run: `node --no-warnings --test tests/team-presence.test.mts`

Expected: PASS.

- [ ] **Step 6: Commit the sidebar roster**

```bash
git add components/team-presence.tsx components/sidebar.tsx tests/team-presence.test.mts
git commit -m "feat: show live team presence in sidebar"
```

### Task 3: App identity wiring, full verification, and release

**Files:**
- Modify: `components/sidebar-shell.tsx`
- Modify: `app/(app)/layout.tsx`
- Test: `tests/team-presence.test.mts`, existing `tests/*.test.mts`

**Interfaces:**
- Consumes `TeamPresence` sidebar props from Task 2.
- Produces the current member’s safe `{ id, name, color? }` identity in the browser sidebar.

- [ ] **Step 1: Add failing wiring assertions**

```ts
test("layout and sidebar shell pass the signed-in VA identity to the sidebar", () => {
  assert.match(readFileSync("app/(app)/layout.tsx", "utf8"), /currentMember=\{\{ id: me\.id, name: me\.name, color: me\.color \}\}/);
  assert.match(readFileSync("components/sidebar-shell.tsx", "utf8"), /currentMember=\{currentMember\}/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --no-warnings --test tests/team-presence.test.mts`

Expected: FAIL because the identity is not yet passed through both components.

- [ ] **Step 3: Wire the current member through layout and shell**

Pass only `me.id`, `me.name`, and `me.color` from the server layout into the client `SidebarShell`, then forward that object to `Sidebar`. Do not expose the authenticated user email.

- [ ] **Step 4: Run all automated checks**

Run: `node --no-warnings --test tests/password-reset.test.mts tests/task-ordering.test.mts tests/task-row-control-styles.test.mts tests/team-presence.test.mts`

Expected: PASS.

Run: `C:\\Users\\Michelle Pink Rejuso\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe node_modules\\next\\dist\\bin\\next build`

Expected: production build succeeds.

- [ ] **Step 5: Commit and push the completed feature**

```bash
git add app/(app)/layout.tsx components/sidebar-shell.tsx tests/team-presence.test.mts
git commit -m "feat: wire signed-in member to team presence"
git push origin main
```

- [ ] **Step 6: Apply the one-time Supabase migration and manual test**

Run `supabase/phase36_team_presence.sql` in the Supabase SQL Editor for the production project. Open two accounts in separate browser sessions and confirm the active, idle, multi-tab, close-tab, and collapsed-sidebar cases in the specification.
