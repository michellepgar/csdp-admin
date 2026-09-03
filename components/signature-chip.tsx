/* A small pill showing a VA's name in their own assigned color (Team
   page "VA Colors") -- used everywhere someone "signs" something
   (task sign-off, checklist auto-sign) so the same name reads as the
   same person's color across the app. Falls back to the plain neutral
   pill styling when the name has no assigned color (e.g. someone no
   longer on the team).

   The text color is blended toward --foreground (color-mix), not the
   VA's raw hex value alone -- a VA can pick any color from a plain
   <input type="color">, with no guarantee it stays legible against a
   DARK page background specifically (a dark navy or maroon pick reads
   fine on light mode's pale tint of it, but nearly disappears against
   dark mode's near-black page). Blending pulls every color toward
   whichever theme's own guaranteed-readable text tone while keeping
   enough of the original hue to still read as "that person's color". */
export function SignatureChip({ name, color, small }: { name: string; color?: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"}`}
      style={
        color
          ? { backgroundColor: `${color}26`, color: `color-mix(in oklch, ${color} 65%, var(--foreground))` }
          : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
      }
    >
      {name}
    </span>
  );
}
