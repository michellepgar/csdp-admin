# Teal Frame, Step 3: Overview Tiles and Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, Michelle's preference). Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- Overview's category tiles (Currently Working On and Planned Work) drop the solid colored header block. Each tile gets a 3px colored top edge and a colored label on white, and floats on a soft shadow.
- The sidebar's 13 different icon colors become one teal icon chip, and the selected page becomes a solid teal pill.

**Architecture:**
- Tiles are drawn by one component, `components/category-columns.tsx`, which both Overview sections use. Its per-VA header color (`darkenForHeader`) becomes the edge color.
- The label color is that edge darkened until it reads at 4.5:1 or better on white. In dark mode it's mixed toward white through a CSS variable, so it stays readable on the dark card.
- Sidebar icons get one `sidebar-nav-icon` class: the svg becomes its own chip through `box-content` padding, styled in `app/globals.css`. The active link gets a `nav-active` class, which flips the chip to a translucent white.

**Spec:** `docs/superpowers/specs/2026-10-19-teal-frame-design.md`, sections 3–4.

---

### Task 1: Tiles (`components/category-columns.tsx`)

- [ ] **Step 1: Add a contrast helper** below `readableTextColor`:

```ts
/* WCAG contrast of a color against white, and that color darkened step by
   step until it reads at 4.5:1 or better there (the tile label sits on a
   white card now, not on its own colored block). */
function contrastOnWhite(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (l + 0.05);
}
function inkOnWhite(hex: string): string {
  let c = hex;
  for (let i = 0; i < 12 && contrastOnWhite(c) < 4.5; i++) c = shade(c, -12);
  return c;
}
```

- [ ] **Step 2: Replace the column markup.** The column `div` and its header `div` become:

```tsx
          <div key={col.category} className="w-64 shrink-0 rounded-lg border-t-[3px] bg-card shadow-sm" style={{ borderTopColor: headerColor }}>
            <div
              className="truncate px-2.5 pt-1.5 pb-1 text-xs font-bold text-(--tile-ink) dark:text-[color-mix(in_oklab,var(--tile-edge)_55%,white)]"
              style={{ "--tile-ink": inkOnWhite(headerColor), "--tile-edge": headerColor } as React.CSSProperties}
              title={col.category}
            >
              {col.category}
            </div>
            <ul className="divide-y border-t">
```

- [ ] **Step 3:** Remove `readableTextColor` if nothing else uses it, so lint stays clean. Add `last:rounded-b-lg` to each `li` so its hover tint follows the rounded bottom.

### Task 2: Sidebar (`components/sidebar.tsx`, `app/globals.css`)

- [ ] **Step 1:** In `navLinkClass`, change the active branch to `"nav-active bg-primary font-semibold text-primary-foreground shadow-[0_2px_6px_-2px_rgb(6_117_136/0.5)]"`. Make the same change to the Overview link's active branch, keeping its `text-base font-bold`.

- [ ] **Step 2:** Replace every icon color pair on the nav icons. `className="h-4 w-4 flex-none text-<c>-600 dark:text-<c>-400"` becomes `className="sidebar-nav-icon h-4 w-4 flex-none"`, and `className="h-4 w-4 text-<c>-600 dark:text-<c>-400"` becomes `className="sidebar-nav-icon h-4 w-4"`. The Overview icon `h-5 w-5 flex-none text-cyan-600 dark:text-cyan-400` becomes `sidebar-nav-icon h-5 w-5 flex-none`. School links are not touched; they keep each VA's color.

- [ ] **Step 3:** Append to `app/globals.css`:

```css
/* Teal Frame sidebar: every nav icon sits in the same small teal chip (the
   svg is its own chip via content-box padding), and on the selected page the
   chip turns translucent white on the solid teal pill. */
.sidebar-nav-icon {
  box-sizing: content-box;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--primary);
}
.nav-active .sidebar-nav-icon {
  background: rgb(255 255 255 / 0.2);
  color: inherit;
}
```

### Task 3: Verify and commit

- [ ] Run `npx tsc --noEmit`, `npx eslint components/category-columns.tsx components/sidebar.tsx`, `npm test` and `npm run build`.
- [ ] Check demo in light and dark:
  - Overview, Currently Working On: Columns view, with tiles for several VAs; labels readable in both themes.
  - Planned Work.
  - Sidebar expanded and collapsed: alert dots still sit on the icons, and each page's pill highlights when it's open.
- [ ] Commit the two source files, `app/globals.css` and this plan. Don't deploy until Michelle says "deploy it".
