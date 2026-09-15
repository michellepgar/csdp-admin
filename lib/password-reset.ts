type AuthError = { message: string } | null;

type UpdateUser = (attributes: { password: string }) => Promise<{ error: AuthError }>;

export async function updatePassword(
  updateUser: UpdateUser,
  password: string,
  confirmation: string,
): Promise<{ error: string | null }> {
  if (password !== confirmation) return { error: "Passwords do not match." };

  const { error } = await updateUser({ password });
  return { error: error?.message ?? null };
}
