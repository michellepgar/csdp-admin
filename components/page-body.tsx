const GAP_CLASSES = { 6: "space-y-6", 8: "space-y-8", 10: "space-y-10" };

/* The padded wrapper for everything below a page's sticky PageHeader
   (or an equivalent custom header, e.g. Overview/the school page).
   Centralizing this one place means the padding that used to live on
   <main> itself (components/sidebar-shell.tsx) only has to be right
   in one spot instead of copy-pasted across every page -- exactly the
   kind of drift that caused the header/sidebar overlap bug this
   replaced. `gap` picks the vertical spacing between this page's own
   sections (each page used a different space-y-* before). */
export function PageBody({ gap = 6, children }: { gap?: keyof typeof GAP_CLASSES; children: React.ReactNode }) {
  return <div className={`p-4 sm:p-6 md:p-8 ${GAP_CLASSES[gap]}`}>{children}</div>;
}
