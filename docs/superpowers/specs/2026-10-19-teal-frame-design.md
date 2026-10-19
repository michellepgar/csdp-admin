# Teal Frame: a softer, more professional look

**Status:** Michelle approved Option B ("Teal Frame") on 2026-10-19, after comparing it with today's look and Option A in the mockup at https://claude.ai/artifact/5ydvzLKc5aAPgxjnUMkhfy (made-up data).

## Goal

The tracker should feel softer and more professional without going pale:
- section bars stay strong teal;
- corners are rounder;
- there is one teal everywhere instead of five;
- cards float on soft shadows instead of hard outlines;
- secondary text steps back, so names and titles stand out.

## Fixed constraints (Michelle's standing rules)

- The 14px root font stays, and so do the fixed sizes: h1/h2 at 15px and records at 12px.
- No flat or pale design. Teal section bars stay, and get deeper rather than lighter.
- The spreadsheet grid is not touched: the `--sheet-*` tokens and the cell styling stay. The spreadsheet's toolbar and menus may pick up the new border and teal.
- Light mode is primary. Dark mode must keep working and read as teal, not indigo.
- Manrope stays.
- No new data, queries or server work. CSS transitions only; no animation libraries, `backdrop-filter`/blur, or per-row animation. A Cloudflare Worker's CPU time is the scarce resource.

## Design

### 1. Foundations (`app/globals.css`, light `:root`)

| Token | Today | Teal Frame |
|---|---|---|
| `--radius` | `0.25rem` (3.5px) | `0.5rem` (7px). Gives sm 4.2, md 5.6, lg 7, xl 9.8px |
| `--primary` | `#067588` | unchanged |
| `--ring` | `#047A6A` | `#067588` (one teal for buttons and focus) |
| `--header-background` | `#067F96` | `#0A5D6B` (white text 7.6:1) |
| new `--header-background-2` | n/a | `#067F96`, the gradient end. Strips get `linear-gradient(135deg, var(--header-background), var(--header-background-2))` |
| new `--brand-band` (top bar) | uses header teal | `#0A4F5C` (white 9:1), a step darker than the strips so it doesn't compete |
| `--border` / `--input` | `#DEDCD5` (warm beige) | `#D6DFE5` / `#C8D2D9` (cool, matching the grey page) |
| `--muted-foreground` | `#173B4D` (same as text) | `#4F6672` (6.0:1 on white, 5.3:1 on the page) |
| `--muted` / `--secondary` | `#D7F1F4` | `#EAF3F5` |
| `--accent`, `--sidebar-accent` | `#D7F1F4` / `#D5F1F5` | `#DCEFF2` |
| `--sidebar-accent-foreground` | `#06707C` | `#0B4A57` |
| `--background` | `#EEF1F5` | unchanged (Michelle's pick) |

**Shadows.** New tokens, wired through `@theme` so the existing `shadow-sm`/`shadow-md` utilities pick them up. They are tinted teal-grey, never pure black.
- xs: `0 1px 2px rgb(10 60 75 / .06)`
- sm: `0 1px 2px rgb(10 60 75 / .06), 0 1px 3px rgb(10 60 75 / .08)`
- md: `0 2px 4px -1px rgb(10 60 75 / .08), 0 10px 24px -8px rgb(10 60 75 / .22)`
- lg: `0 4px 8px -2px rgb(10 60 75 / .08), 0 16px 28px -6px rgb(10 60 75 / .18)`
- Dark mode uses the same offsets with `rgb(0 0 0 / .35–.5)`.

**Dark mode** (`.dark`). Move the surfaces from shadcn's indigo (hue 264) to teal (hue about 215–220):
- background `oklch(0.17 0.02 220)`
- card, sidebar and popover `oklch(0.215 0.022 220)`
- muted, secondary and accent `oklch(0.28 0.03 215)`
- strips `oklch(0.30 0.06 210)` → `oklch(0.36 0.07 205)`
- brand band `oklch(0.26 0.05 212)`

Text stays near-white, and the dark `--sheet-*` values stay as they are.

**Other global rules**
- Text fields use `border-radius: var(--radius-lg)` (numbers use `--radius-md`) instead of `0.6rem`/`0.5rem`.
- The spreadsheet cell editor is excluded from the rounding and glow rules, so cells stay square.
- Record rows lift with `var(--shadow-xs)`.

### 2. Section bars and cards

- **Global `h1`/`h2`** and every `bg-header-background` strip (about 20 strips in 17 files, all white text) get the gradient. Padding goes to `py-2`, and weight drops a step: h1 700 → 600 is fine because the white-on-deep-teal contrast stays above 7:1.
- **`SectionCard`** becomes `rounded-xl`, `shadow-md` and borderless, with its strip on the gradient. The icon chip stays translucent white.
- **Hand-built strips** inside cards get the card's rounded top (`overflow-hidden` on the wrapper).
- **`Card` (`components/ui/card.tsx`)** swaps `ring-1` for `shadow-md`.
- **Top bar (`components/app-top-bar.tsx`)** uses `bg-brand-band`. The Quick add button keeps its darker look but comes from a token instead of `#0C3B4A`.
- **`text-white/70` and `/80` labels** on strips go to `text-white/90` (today they fail AA).

### 3. Overview tiles

Category tiles in Currently Working On, Planned Work and the category columns lose their solid colored header block. Instead:
- the category color becomes a **3px top edge** and the label text color;
- the label sits on white;
- the tile gets `shadow-sm` and no outline.

The existing category colors and data are reused. Nothing new is loaded.

### 4. Sidebar

- The 13 different icon colors become **one icon chip**: `bg-accent text-primary`.
- The selected item becomes a **solid teal pill**: `bg-primary text-white`, a white-tinted icon chip and a soft teal glow.
- School dots keep each VA's color.

### 5. Buttons and pills

- The default button uses `bg-primary`, with a hover a shade darker.
- Transitions cover color, background, border and shadow only, at 200ms.
- The hover "hop" (`-translate-y-px`) is removed. The press-down stays.
- Status pills become fully rounded (`rounded-full`). Their colors stay the same.

## Rollout

Each step ships on its own. Michelle checks it in demo mode, in light and dark, before it deploys.

1. **Foundations:** section 1. This is the biggest visible change for the least risk.
2. **Section bars and cards:** section 2.
3. **Overview tiles and sidebar:** sections 3 and 4.
4. **Buttons and pills:** section 5.

**Later (optional, not part of this spec):** move the remaining hard-coded Tailwind colors in the top offenders onto tokens, one file at a time. Those files are automatic-backups, workspace-list and task-priorities.

## Verification for every step

- Run `npx tsc --noEmit`, `npm test` and `npm run build`.
- Tests that check exact source text must keep passing: `tests/top-bar.test.mts` (`sticky top-14 z-10`), `tests/task-row-control-styles.test.mts`, `tests/team-presence.test.mts` and `tests/sanitize-note-html.test.mts` (token name `--muted-foreground`).
- Check demo mode in the Browser pane: Overview, a school page (Tasks and Email tracker), Contacts, Distribution List, My Workspace, Spreadsheets, Team and Admin Settings, in both light and dark.
- Contrast: body text and pills at least 4.5:1, and white on strips at least 4.5:1.

## Out of scope

Font changes, text sizes, layout or markup restructuring (for example, merging the separate phone and desktop table markup), spreadsheet grid colors, new features, and data changes.
