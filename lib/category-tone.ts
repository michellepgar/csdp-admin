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

type CategoryToneClasses = { edge: string; pill: string };

/* A longer set for pages that show many categories side by side (General
   Tasks): 17 clearly different hues, then the same hues in a deeper shade --
   34 colors before anything would repeat. Spelled out in full so Tailwind
   picks the class names up. */
const DISTINCT_TONES: CategoryToneClasses[] = [
  { edge: "border-l-teal-500", pill: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200" },
  { edge: "border-l-orange-500", pill: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200" },
  { edge: "border-l-violet-500", pill: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200" },
  { edge: "border-l-sky-500", pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200" },
  { edge: "border-l-rose-500", pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200" },
  { edge: "border-l-amber-500", pill: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
  { edge: "border-l-emerald-500", pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" },
  { edge: "border-l-indigo-500", pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200" },
  { edge: "border-l-fuchsia-500", pill: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200" },
  { edge: "border-l-lime-500", pill: "bg-lime-100 text-lime-900 dark:bg-lime-500/15 dark:text-lime-200" },
  { edge: "border-l-cyan-500", pill: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200" },
  { edge: "border-l-red-500", pill: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200" },
  { edge: "border-l-blue-500", pill: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200" },
  { edge: "border-l-pink-500", pill: "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-200" },
  { edge: "border-l-green-500", pill: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200" },
  { edge: "border-l-purple-500", pill: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-200" },
  { edge: "border-l-yellow-500", pill: "bg-yellow-100 text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-200" },
  { edge: "border-l-teal-700", pill: "bg-teal-200 text-teal-900 dark:bg-teal-500/30 dark:text-teal-100" },
  { edge: "border-l-orange-700", pill: "bg-orange-200 text-orange-900 dark:bg-orange-500/30 dark:text-orange-100" },
  { edge: "border-l-violet-700", pill: "bg-violet-200 text-violet-900 dark:bg-violet-500/30 dark:text-violet-100" },
  { edge: "border-l-sky-700", pill: "bg-sky-200 text-sky-900 dark:bg-sky-500/30 dark:text-sky-100" },
  { edge: "border-l-rose-700", pill: "bg-rose-200 text-rose-900 dark:bg-rose-500/30 dark:text-rose-100" },
  { edge: "border-l-amber-700", pill: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100" },
  { edge: "border-l-emerald-700", pill: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100" },
  { edge: "border-l-indigo-700", pill: "bg-indigo-200 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-100" },
  { edge: "border-l-fuchsia-700", pill: "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-500/30 dark:text-fuchsia-100" },
  { edge: "border-l-lime-700", pill: "bg-lime-200 text-lime-900 dark:bg-lime-500/30 dark:text-lime-100" },
  { edge: "border-l-cyan-700", pill: "bg-cyan-200 text-cyan-900 dark:bg-cyan-500/30 dark:text-cyan-100" },
  { edge: "border-l-red-700", pill: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-100" },
  { edge: "border-l-blue-700", pill: "bg-blue-200 text-blue-900 dark:bg-blue-500/30 dark:text-blue-100" },
  { edge: "border-l-pink-700", pill: "bg-pink-200 text-pink-900 dark:bg-pink-500/30 dark:text-pink-100" },
  { edge: "border-l-green-700", pill: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-100" },
  { edge: "border-l-purple-700", pill: "bg-purple-200 text-purple-900 dark:bg-purple-500/30 dark:text-purple-100" },
  { edge: "border-l-yellow-700", pill: "bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100" },
];

/* Every category in `names` gets its own color, assigned in list order so no
   two categories on the page share one (a hash, like categoryTone above,
   can land two names on the same color). Pass the full category list in its
   saved order so a category keeps its color even when others have no tasks. */
export function distinctCategoryTones(names: string[]): Map<string, CategoryToneClasses> {
  const tones = new Map<string, CategoryToneClasses>();
  let next = 0;
  for (const name of names) {
    if (tones.has(name)) continue;
    tones.set(name, name ? DISTINCT_TONES[next++ % DISTINCT_TONES.length] : { edge: "border-l-slate-300", pill: "bg-muted text-foreground" });
  }
  return tones;
}
