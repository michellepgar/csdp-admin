# Teal Frame, Step 2: Section Bars and Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Michelle's standing preference: inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Section bars get a deep-teal shading and rounded tops, and the cards around them float on a soft shadow instead of a hard outline. The top bar gets its own darker band.

**Architecture:**
- **Shading.** One unlayered CSS rule gives every `.bg-header-background` element the gradient, so the ~20 hand-built strips change without touching their color classes.
- **Headings.** The global `h1`/`h2` base rules get the same gradient. Headings that sit inside a strip are made transparent, so no seam shows.
- **Wrappers.** Card wrappers around strips change from `rounded-md border bg-card` to `rounded-xl bg-card shadow-md`, and their strips get `rounded-t-xl py-2`. That's a per-file class edit with no `overflow-hidden`, so menus inside cards are never clipped.

**Spec:** `docs/superpowers/specs/2026-10-19-teal-frame-design.md`, section 2.

---

### Task 1: Gradient and heading rules (`app/globals.css`)

- [ ] **Step 1:** In the `@layer base` h1/h2 rules, change the h1 weight `font-bold` to `font-semibold`, h2 `px-2 py-1` to `px-3 py-2 rounded-lg`, and add a gradient to both:

```css
  h1 {
    @apply text-white sticky top-0 z-10 block bg-header-background px-3 py-1.5 font-semibold;
    background-image: linear-gradient(135deg, var(--header-background), var(--header-background-2));
    font-size: 15px;
  }
  h2 {
    @apply text-white block bg-header-background px-3 py-2 rounded-lg font-semibold;
    background-image: linear-gradient(135deg, var(--header-background), var(--header-background-2));
    font-size: 15px;
  }
```

- [ ] **Step 2:** Append, outside any layer:

```css
/* Teal Frame: every section bar gets the deep-teal shading. Headings that
   sit inside a bar drop their own bar look (background, padding, corners)
   so the shading runs through without a seam. */
.bg-header-background {
  background-image: linear-gradient(135deg, var(--header-background), var(--header-background-2));
}
.bg-header-background :is(h1, h2) {
  background: transparent;
  border-radius: 0;
  padding: 0;
}
```

### Task 2: Floating cards with rounded bar tops

Make each change below exactly. The wrapper becomes `rounded-xl bg-card shadow-md`, which drops `rounded-md border`. The strip drops `border-b` and `py-1`, and gains `rounded-t-xl py-2`.

- [ ] `app/(app)/schools/[id]/page.tsx:230-231` (Contact Info)
- [ ] `components/checklist-card.tsx:108-109`. The collapsed bar at `:95` changes from `rounded-md border` to `rounded-xl shadow-md`, keeping `py-1` → `py-2`.
- [ ] `components/email-notes-card.tsx:20-21`
- [ ] `components/email-tracker-card.tsx:110-111`
- [ ] `components/general-tasks-list.tsx:355-356`
- [ ] `components/tasks-card.tsx:448-449`
- [ ] `components/distribution-list.tsx`: the group wrapper `rounded-md border bg-card` (about line 701) and its strip at about line 709.
- [ ] `components/contacts-list.tsx`: the group wrapper `overflow-hidden rounded-xl border bg-card shadow-sm` (about line 509) becomes `overflow-hidden rounded-xl bg-card shadow-md`. Its strip at line 517 drops `border-b` and `py-1` → `py-2`. It already clips, so the strip needs no `rounded-t-xl`.
- [ ] `components/automatic-backups.tsx:155`: `overflow-hidden rounded-xl border shadow-sm` becomes `overflow-hidden rounded-xl shadow-md`.
- [ ] `app/(app)/overview/page.tsx:241`: the standalone strip `mb-3 flex items-center justify-between bg-header-background px-2 py-1` becomes `mb-3 flex items-center justify-between rounded-xl bg-header-background px-3 py-2 shadow-sm`.
- [ ] `components/section-card.tsx:28`: `overflow-hidden rounded-xl border bg-record-background no-record-hover shadow-sm` becomes `overflow-hidden rounded-xl bg-record-background no-record-hover shadow-md`.
- [ ] `components/ui/card.tsx`: replace the `ring-1 ring-foreground/10` (or whichever `ring-*` the base class uses) with `shadow-md`.

### Task 3: Readable faint labels on bars

- [ ] Replace `text-white/70` and `text-white/80` with `text-white/90` in:
  - `components/checklist-card.tsx:97,111`
  - `components/collapsible-section.tsx:39`
  - `components/distribution-list.tsx:724`
  - `components/general-tasks-list.tsx:358`
  - `components/tasks-card.tsx:451`

### Task 4: Top bar on its own band

- [ ] `components/app-top-bar.tsx:123`: change `bg-header-background` to `bg-brand-band`.
- [ ] `components/app-top-bar.tsx:154`: change `bg-[#0C3B4A]` to `bg-black/25`, and `hover:bg-[#0A2F3B]` to `hover:bg-black/35`.
- [ ] `components/app-top-bar.tsx:168`: change `bg-[#0C3B4A]` to `bg-black/25`.
- [ ] Keep `tests/top-bar.test.mts` passing, since it expects `sticky top-14 z-10` in page-header and must not change.

### Task 5: Verify and commit

- [ ] Run `npx tsc --noEmit`, `npm test` and `npm run build`. All must pass.
- [ ] Check demo mode in light and dark:
  - Overview, a school page (Tasks, Checklist collapsed and open, Email Tracker, Email Notes, Contact Info), General Tasks, Contacts, Distribution List, Admin Settings (Backups), and the Quick add dialog and notification bell headers.
  - No seams inside bars, no corners poking out, menus inside Tasks still open fully.
- [ ] Commit only the files above plus this plan. Don't deploy until Michelle says "deploy it".
