/* A category's own color -- the same category name always gets the same
   color, so it reads the same on every page (Email Templates, General
   Tasks). Spelled out as full class names so Tailwind picks them up. */
const CATEGORY_TONES = [
  { edge: "border-l-teal-500", pill: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200" },
  { edge: "border-l-orange-500", pill: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200" },
  { edge: "border-l-violet-500", pill: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200" },
  { edge: "border-l-sky-500", pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200" },
  { edge: "border-l-rose-500", pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200" },
  { edge: "border-l-amber-500", pill: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
];

export function categoryTone(category: string | undefined): { edge: string; pill: string } {
  if (!category) return { edge: "border-l-slate-300", pill: "bg-muted text-foreground" };
  let hash = 0;
  for (const ch of category.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
}
