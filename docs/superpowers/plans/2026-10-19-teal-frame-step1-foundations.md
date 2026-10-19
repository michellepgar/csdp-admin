# Teal Frame, Step 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Michelle's standing preference for this project is inline execution (executing-plans), not subagents.

**Goal:** Give every page the Teal Frame foundations in one pass: one teal, rounder corners, cool borders, softer secondary text, tinted soft shadows and a teal dark mode. The work is design tokens in `app/globals.css` plus one class hook.

**Architecture:** All colors and radii already flow from CSS variables in `app/globals.css`: `:root` holds light mode, `.dark` holds dark mode, and `@theme inline` maps the variables to Tailwind utilities. Changing the variables restyles every page at once. Shadows get new `--sh-*` variables, mapped through `@theme inline` so the existing `shadow-xs/sm/md/lg` utilities pick them up. The spreadsheet's cell editor gets a `cell-editor` class so it can opt out of field rounding and focus glow.

**Tech Stack:** Next.js 16, Tailwind v4 (`@theme inline`), shadcn tokens, next-themes `.dark` class.

**Spec:** `docs/superpowers/specs/2026-10-19-teal-frame-design.md`, section 1.

---

### Task 1: Light-mode tokens (`:root`)

**Files:**
- Modify: `app/globals.css` (`:root` block, roughly lines 98–203)

- [ ] **Step 1: Replace these values in `:root`, one token at a time** (keep the existing comments):

| Line now | Becomes |
|---|---|
| `--ring: #047A6A; /* … */` | `--ring: #067588; /* one teal: same as --primary (was #047A6A, a greener second teal) */` |
| `--secondary: #D7F1F4;` | `--secondary: #EAF3F5;` |
| `--muted: #D7F1F4;` | `--muted: #EAF3F5;` |
| `--muted-foreground: #173B4D;` | `--muted-foreground: #4F6672; /* details step back: 6.0:1 on white, 5.3:1 on the page */` |
| `--accent: #D7F1F4;` | `--accent: #DCEFF2;` |
| `--border: #DEDCD5;` | `--border: #D6DFE5; /* cool grey to match the page (was warm beige #DEDCD5) */` |
| `--input: #DEDCD5;` | `--input: #C8D2D9;` |
| `--radius: 0.25rem;` | `--radius: 0.5rem; /* 7px at the 14px root (was 3.5px) */` |
| `--sidebar-accent: #D5F1F5;` | `--sidebar-accent: #DCEFF2;` |
| `--sidebar-accent-foreground: #06707C;` | `--sidebar-accent-foreground: #0B4A57;` |
| `--sidebar-border: #DEDCD5;` | `--sidebar-border: #D6DFE5;` |
| `--header-background: #067F96;` | `--header-background: #0A5D6B; /* deeper teal bars, white text 7.6:1 */` |

- [ ] **Step 2: Add the new tokens** directly after `--header-background`:

```css
  /* Teal Frame: the lighter end of the section-bar shading, and the top
     bar's own darker band so it doesn't compete with section bars. */
  --header-background-2: #067F96;
  --brand-band: #0A4F5C;
  /* Soft shadows tinted teal-grey instead of pure black (wired to
     shadow-xs/sm/md/lg in @theme inline). */
  --sh-xs: 0 1px 2px rgb(10 60 75 / 0.06);
  --sh-sm: 0 1px 2px rgb(10 60 75 / 0.06), 0 1px 3px rgb(10 60 75 / 0.08);
  --sh-md: 0 2px 4px -1px rgb(10 60 75 / 0.08), 0 10px 24px -8px rgb(10 60 75 / 0.22);
  --sh-lg: 0 4px 8px -2px rgb(10 60 75 / 0.08), 0 16px 28px -6px rgb(10 60 75 / 0.18);
```

### Task 2: Map the new tokens in `@theme inline`

**Files:**
- Modify: `app/globals.css` (`@theme inline`, lines 7–75)

- [ ] **Step 1: After `--color-header-background: var(--header-background);`, add:**

```css
  --color-header-background-2: var(--header-background-2);
  --color-brand-band: var(--brand-band);
  --shadow-xs: var(--sh-xs);
  --shadow-sm: var(--sh-sm);
  --shadow-md: var(--sh-md);
  --shadow-lg: var(--sh-lg);
```

### Task 3: Dark mode turns teal (`.dark`)

**Files:**
- Modify: `app/globals.css` (`.dark` block, roughly lines 205–268)

- [ ] **Step 1: Replace these values in `.dark`:**

| Token | New value |
|---|---|
| `--background` | `oklch(0.17 0.02 220)` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`, `--sidebar-foreground`, `--sidebar-accent-foreground` | `oklch(0.97 0.006 220)` |
| `--card`, `--popover`, `--sidebar` | `oklch(0.215 0.022 220)` |
| `--primary-foreground`, `--sidebar-primary-foreground` | `oklch(0.17 0.02 220)` |
| `--secondary`, `--muted`, `--accent`, `--sidebar-accent`, `--status-neutral` | `oklch(0.28 0.03 215)` |
| `--muted-foreground` | `oklch(0.74 0.02 220)` |
| `--status-neutral-foreground` | `oklch(0.87 0.02 215)` |
| `--header-background` | `oklch(0.30 0.06 210)` |
| `--row-hover` | `oklch(0.30 0.035 215)` |

- [ ] **Step 2: Add after the dark `--header-background`:**

```css
  --header-background-2: oklch(0.36 0.07 205);
  --brand-band: oklch(0.26 0.05 212);
  --sh-xs: 0 1px 2px rgb(0 0 0 / 0.35);
  --sh-sm: 0 1px 2px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.4);
  --sh-md: 0 2px 4px -1px rgb(0 0 0 / 0.4), 0 10px 24px -8px rgb(0 0 0 / 0.5);
  --sh-lg: 0 4px 8px -2px rgb(0 0 0 / 0.4), 0 16px 28px -6px rgb(0 0 0 / 0.5);
```

Leave every `--sheet-*`, `--status-success/warning/danger/paused*`, `--plan-accent*`, `--title-background` and `--record-background` value unchanged.

### Task 4: Record rows, field corners, spreadsheet cell editor

**Files:**
- Modify: `app/globals.css` (the `.bg-record-background` rule at about line 433, and the field-rounding rule at about line 711)
- Modify: `components/workspace-table-block.tsx:54`

- [ ] **Step 1: Record-row lift uses the token.** In `.bg-record-background { … }`, replace `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);` with `box-shadow: var(--sh-xs);`.

- [ ] **Step 2: Field corners follow the radius.** In the rounding rule, replace `border-radius: 0.6rem;` with `border-radius: var(--radius-lg);` and the number rule's `border-radius: 0.5rem;` with `border-radius: var(--radius-md);`. Then append right after that rule:

```css
/* The spreadsheet's cell editor (components/workspace-table-block.tsx)
   stays a plain square cell: no field rounding or focus glow. !important
   because the field rules above use long :not() chains with higher
   specificity. */
.cell-editor {
  border-radius: 0 !important;
  box-shadow: none !important;
}
```

- [ ] **Step 3: Tag the cell editor.** In `components/workspace-table-block.tsx:54`, change

```ts
const EDITOR = "h-8 w-full min-w-0 bg-background px-2 text-sm text-foreground outline-none";
```

to

```ts
const EDITOR = "cell-editor h-8 w-full min-w-0 bg-background px-2 text-sm text-foreground outline-none";
```

### Task 5: Verify and commit

- [ ] **Step 1:** Run `npx tsc --noEmit`. Expected: no errors (stale `.next/` type errors can be cleared with `rm -rf .next/dev/types`).
- [ ] **Step 2:** Run `npm test`. Expected: all pass. That includes `tests/sanitize-note-html.test.mts`, which only needs the token name `--muted-foreground`.
- [ ] **Step 3:** Run `npm run build`. Expected: compiled successfully.
- [ ] **Step 4:** Check demo mode in the Browser pane (`/login` → "See a demo"), light and then dark. Pages: Overview, a school page, Contacts, Distribution List, My Workspace, a spreadsheet (cells still square, grid unchanged), Team. Check:
  - corners are rounder;
  - borders are cool grey;
  - school names and labels are softer grey-blue but readable;
  - section bars are deeper teal;
  - dark mode is teal, not indigo;
  - no white-on-white or dark-on-dark text.
- [ ] **Step 5:** Commit only these files:

```bash
git add app/globals.css components/workspace-table-block.tsx docs/superpowers/plans/2026-10-19-teal-frame-step1-foundations.md
git commit -m "Teal Frame step 1: one teal, rounder corners, cool borders, softer detail text, teal-tinted shadows, teal dark mode (tokens only; spreadsheet grid unchanged)"
```

Don't deploy until Michelle has seen it and says "deploy it".
