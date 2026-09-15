export function isPublicAuthRoute(pathname: string) {
  return pathname === "/login" || pathname === "/reset-password";
}
