# Teal Frame, Step 4: Buttons and Pills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, Michelle's preference). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Smoother, calmer controls. Buttons fade their color and shadow over 200ms without the little upward hop on hover, and keep the press-down. Status dropdowns become fully rounded pills that match the read-only status badges, which are already `rounded-full`.

**Spec:** `docs/superpowers/specs/2026-10-19-teal-frame-design.md`, section 5.

**Deviation from spec, noted:** the default button keeps `bg-ring`, not `bg-primary`.
- In light mode the two are now the same teal (#067588) after step 1.
- In dark mode `--primary` is a light cyan, which white button text can't sit on. `--ring` is the darker teal that keeps white text readable.

---

### Task 1: `components/ui/button.tsx`

- [ ] In the base class, replace `transition-all` with `transition-[color,background-color,border-color,box-shadow] duration-200 ease-out`.
- [ ] Remove `hover:-translate-y-px` from the `default`, `plan` and `outline` variants. Keep the `active:not-aria-[haspopup]:translate-y-px` press-down in the base class.

### Task 2: `components/status-select.tsx`

- [ ] At line 116, change the trigger `rounded-md border px-1.5` to `rounded-full border px-2.5`.
- [ ] At line 123, change the options popup `rounded-md` to `rounded-lg`.

### Task 3: Verify and commit

- [ ] Run `npx tsc --noEmit`, `npm test` and `npm run build`.
- [ ] Check demo: on a school page's Tasks and Email Tracker, the status pills are rounded, the dropdown still opens and saving a status works. Buttons don't hop on hover.
- [ ] Commit the two files and this plan. Don't deploy until Michelle says "deploy it".
