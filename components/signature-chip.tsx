/* A small pill showing a VA's name in their own assigned color (Team
   page "VA Colors") -- used everywhere someone "signs" something
   (task sign-off, checklist auto-sign) so the same name reads as the
   same person's color across the app. Falls back to the plain neutral
   pill styling when the name has no assigned color (e.g. someone no
   longer on the team). */
export function SignatureChip({ name, color, small }: { name: string; color?: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={
        color
          ? { backgroundColor: `${color}26`, color }
          : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
      }
    >
      {name}
    </span>
  );
}
