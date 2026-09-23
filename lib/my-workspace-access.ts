/* My Workspace (Document Review) is restricted to Michelle specifically --
   checked by exact email match, not the `admin` flag, so a future second
   admin doesn't automatically see it. Used to gate the page itself
   (app/(app)/my-workspace/page.tsx), its Server Actions
   (app/(app)/my-workspace/actions.ts), and its nav entries
   (components/sidebar.tsx, components/command-palette.tsx). */
const MY_WORKSPACE_EMAIL = "michellepgar@gmail.com";

export function isMyWorkspaceUser(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === MY_WORKSPACE_EMAIL;
}
