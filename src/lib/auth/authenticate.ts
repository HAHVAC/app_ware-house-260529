export interface AuthUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
}

export type UserLookup = (username: string) => Promise<AuthUserRecord | null>;
export type PasswordVerify = (plain: string, hash: string) => Promise<boolean>;

export async function authenticate(
  lookup: UserLookup,
  verify: PasswordVerify,
  username: string,
  password: string,
): Promise<AuthUserRecord | null> {
  const user = await lookup(username);
  if (!user || !user.isActive) return null;
  const ok = await verify(password, user.passwordHash);
  return ok ? user : null;
}
