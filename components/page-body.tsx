const GAP_CLASSES = { 6: "space-y-6", 8: "space-y-8", 10: "space-y-10" };

/* The padded wrapper for everything below a page's sticky PageHeader
   (or an equivalent custom header, e.g. Overview/the school page).
   Centralizing this one place means the padding that used to live on
   <main> itself (components/sidebar-shell.tsx) only has to be right
   in one spot instead of copy-pasted across every page -- exactly the
   kind of drift that caused the header/sidebar overlap bug this
   replaced. `gap` picks the vertical spacing between this page's own
   sections (each page used a different space-y-* before). */
/* The extra bottom padding lets the last things on a page scroll up clear
   of the floating chat and Your Plan buttons in the bottom-right corner.
   A page that fits the screen exactly (Messages) turns it off. */
export function PageBody({ gap = 6, roomForFloatingButtons = true, children }: { gap?: keyof typeof GAP_CLASSES; roomForFloatingButtons?: boolean; children: React.ReactNode }) {
  return <div className={`p-4 sm:p-6 md:p-8 ${roomForFloatingButtons ? "pb-36 sm:pb-36 md:pb-36" : ""} ${GAP_CLASSES[gap]}`}>{children}</div>;
}
