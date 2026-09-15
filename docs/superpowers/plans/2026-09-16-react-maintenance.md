# React Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the project lint clean while preserving all existing user-visible behavior.

**Architecture:** Keep existing components and APIs. Tighten ESLint file selection, then replace render-time ref reads with event-time measurements and replace synchronous state-mirroring effects with behavior-equivalent component state patterns.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-react-maintenance-design.md`

## Global Constraints

- No database migrations or Supabase policy changes.
- No design, copy, workflow, or navigation changes for users.
- No broad rule suppression or disabling ESLint rules.
- Preserve existing worktree and generated-file ignores.

---

## File Structure

- Modify `eslint.config.mjs`: ignore temporary worktrees and generated artifacts.
- Modify `components/hover-label.tsx`, `components/icon-tooltip.tsx`, `components/schools-flyout.tsx`: measure anchors from open/focus events instead of render-time ref reads.
- Modify `app/login/page.tsx`, `app/reset-password/page.tsx`: derive one-time URL errors without synchronous state-setting effects.
- Modify `components/dropdown.tsx`, `components/checklist-card.tsx`, `components/tasks-card.tsx`, `components/private-notes-board.tsx`, `components/sticky-note-composer.tsx`, `components/sidebar-shell.tsx`, `components/theme-toggle.tsx`: preserve current state resets without lint-invalid effect bodies.
- Modify `tests/*.test.mts`: retain existing password-reset/task-order behavior and add static contracts for the corrected lint/config patterns.

### Task 1: Restore useful lint boundaries

**Files:**
- Modify: `eslint.config.mjs`
- Test: `tests/lint-config.test.mts`

**Interfaces:**
- Produces a lint configuration that checks repository source but ignores `.next/**`, `.worktrees/**`, `node_modules/**`, `out/**`, and `build/**`.

- [ ] **Step 1: Write a failing configuration test**

```ts
test("lint ignores generated worktree output", () => {
  const config = readFileSync("eslint.config.mjs", "utf8");
  assert.match(config, /"\.worktrees\/\*\*"/);
  assert.match(config, /"node_modules\/\*\*"/);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --no-warnings --test tests/lint-config.test.mts`

Expected: FAIL because `.worktrees/**` is absent.

- [ ] **Step 3: Add only the missing global ignores**

```ts
globalIgnores([".next/**", ".worktrees/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts"])
```

- [ ] **Step 4: Verify source lint and tests**

Run: `npm run lint`

Expected: source findings only; no `.worktrees` or `.next` paths appear.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs tests/lint-config.test.mts
git commit -m "fix: scope lint to source files"
```

### Task 2: Correct tooltip/flyout ref handling

**Files:**
- Modify: `components/hover-label.tsx`
- Modify: `components/icon-tooltip.tsx`
- Modify: `components/schools-flyout.tsx`
- Test: `tests/lint-config.test.mts`

**Interfaces:**
- Produces unchanged tooltip/flyout labels and placement, with `DOMRect | undefined` stored by opening/focus events rather than read from `ref.current` in render.

- [ ] **Step 1: Add failing source-contract tests**

```ts
for (const file of ["components/hover-label.tsx", "components/icon-tooltip.tsx", "components/schools-flyout.tsx"]) {
  test(`${file} measures its anchor outside render`, () => {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /const rect = open \? .*\.current/);
    assert.match(source, /getBoundingClientRect\(\)/);
  });
}
```

- [ ] **Step 2: Verify the test fails**

Run: `node --no-warnings --test tests/lint-config.test.mts`

Expected: FAIL for the current render-time ref reads.

- [ ] **Step 3: Store the rectangle when opening**

```tsx
const [rect, setRect] = useState<DOMRect>();
function openLabel() {
  setRect(anchorRef.current?.getBoundingClientRect());
  setOpen(true);
}
```

Use this handler for hover and focus; clear only `open` on leave/blur. Keep each existing `TooltipBubble` label, side, trigger, and layout class unchanged.

- [ ] **Step 4: Verify focused checks**

Run: `node --no-warnings --test tests/lint-config.test.mts`

Expected: PASS.

Run: `npx eslint components/hover-label.tsx components/icon-tooltip.tsx components/schools-flyout.tsx`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/hover-label.tsx components/icon-tooltip.tsx components/schools-flyout.tsx tests/lint-config.test.mts
git commit -m "fix: measure tooltip anchors outside render"
```

### Task 3: Preserve state synchronization without synchronous effects

**Files:**
- Modify: `app/login/page.tsx`, `app/reset-password/page.tsx`
- Modify: `components/dropdown.tsx`, `components/checklist-card.tsx`, `components/tasks-card.tsx`
- Modify: `components/private-notes-board.tsx`, `components/sticky-note-composer.tsx`, `components/sidebar-shell.tsx`, `components/theme-toggle.tsx`
- Test: `tests/password-reset.test.mts`, `tests/task-ordering.test.mts`, `tests/task-row-control-styles.test.mts`

**Interfaces:**
- Preserves existing props, form submissions, URL error text, reset behavior, drag order, file-name saving, and current mobile/sidebar behavior.

- [ ] **Step 1: Extend failing regression checks before refactoring**

```ts
test("password recovery still displays a fragment error before it clears the URL", () => {
  assert.equal(getRecoveryError("#error=access_denied&error_code=otp_expired"), "That link expired before it was clicked. Request a new reset link.");
});

test("task order still follows the submitted identifier sequence", () => {
  assert.deepEqual(getOrderedItems([{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 1 }], ["b", "a"]).map((item) => item.id), ["b", "a"]);
});
```

- [ ] **Step 2: Run tests to establish the pre-refactor behavior**

Run: `node --no-warnings --test tests/password-reset.test.mts tests/task-ordering.test.mts tests/task-row-control-styles.test.mts`

Expected: PASS before changing production components.

- [ ] **Step 3: Refactor each state boundary minimally**

For URL errors, derive the initial recovery/error state from the location before render and retain only the existing asynchronous auth listeners in effects. For ordered props, use a keyed child component or event-time reset so a changed task/template identity resets local drag order exactly as before. For controlled dropdowns, use the supplied `value` directly when defined and retain local state only for uncontrolled use. For note dimensions/editor drafts and mounted/mobile flags, initialize or key state from the exact existing props rather than synchronously assigning state inside an effect.

- [ ] **Step 4: Run focused behavior tests and lint**

Run: `node --no-warnings --test tests/password-reset.test.mts tests/task-ordering.test.mts tests/task-row-control-styles.test.mts`

Expected: PASS.

Run: `npx eslint app/login/page.tsx app/reset-password/page.tsx components/dropdown.tsx components/checklist-card.tsx components/tasks-card.tsx components/private-notes-board.tsx components/sticky-note-composer.tsx components/sidebar-shell.tsx components/theme-toggle.tsx`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/reset-password/page.tsx components/dropdown.tsx components/checklist-card.tsx components/tasks-card.tsx components/private-notes-board.tsx components/sticky-note-composer.tsx components/sidebar-shell.tsx components/theme-toggle.tsx tests/password-reset.test.mts tests/task-ordering.test.mts tests/task-row-control-styles.test.mts
git commit -m "fix: preserve UI state without synchronous effects"
```

### Task 4: Complete lint cleanup and release verification

**Files:**
- Modify only source files reported by `npm run lint` after Tasks 1-3.
- Test: all existing `tests/*.test.mts`.

**Interfaces:**
- Produces a zero-error lint result without disabling rules or changing user-facing workflows.

- [ ] **Step 1: Run the complete lint check and record remaining source-only findings**

Run: `npm run lint`

Expected: no generated-file paths; only source files, if any, are listed.

- [ ] **Step 2: Remove remaining unused variables and intentional-navigation warnings safely**

Remove truly unused state/parameters. Replace internal navigation with the Next client router only when it preserves the post-auth session refresh; otherwise keep the intentional full reload and use a narrowly documented source-level exception.

- [ ] **Step 3: Verify all checks**

Run: `node --no-warnings --test tests/password-reset.test.mts tests/task-ordering.test.mts tests/task-row-control-styles.test.mts tests/team-presence.test.mts tests/lint-config.test.mts`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0 with no errors.

Run: `node node_modules/next/dist/bin/next build`

Expected: production build succeeds.

- [ ] **Step 4: Commit and push**

```bash
git add eslint.config.mjs app components lib tests
git commit -m "fix: complete react maintenance cleanup"
git push origin main
```
