type AuthError = { message: string } | null;

type UpdateUser = (attributes: { password: string }) => Promise<{ error: AuthError }>;

export function getRecoveryError(hash: string) {
  if (!hash.includes("error=")) return null;

  const params = new URLSearchParams(hash.slice(1));
  if (params.get("error_code") === "otp_expired") {
    return "That password-reset link expired before it was clicked. Request a new one from the sign-in page.";
  }

  return params.get("error_description")?.replace(/\+/g, " ") ?? "This password-reset link is invalid. Request a new one from the sign-in page.";
}

export function isPasswordRecoveryEvent(event: string, session: unknown) {
  return event === "PASSWORD_RECOVERY" && session !== null;
}

export function scheduleLoginRedirect(
  schedule: (callback: () => void, delay: number) => unknown,
  redirectToLogin: () => void,
) {
  schedule(redirectToLogin, 3000);
}

export async function updatePassword(
  updateUser: UpdateUser,
  password: string,
  confirmation: string,
): Promise<{ error: string | null }> {
  if (password !== confirmation) return { error: "Passwords do not match." };

  const { error } = await updateUser({ password });
  return { error: error?.message ?? null };
}
