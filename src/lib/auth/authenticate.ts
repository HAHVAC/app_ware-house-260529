export interface AuthUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
}

export type UserLookup = (username: string) => Promise<AuthUserRecord | null>;
export type PasswordVerify = (plain: string, hash: string) => Promise<boolean>;

// Một bcrypt hash hợp lệ nhưng không khớp mật khẩu nào. Khi không tìm thấy user,
// ta vẫn chạy verify với hash giả này để thời gian phản hồi không khác biệt
// (chống dò tên đăng nhập qua thời gian — username enumeration).
const DUMMY_HASH = "$2b$12$zfKmHQZEO9W.ASqHQwJBC..Ist5RcAp8/KpGRJahIY3pU7wXTVzpO";

export async function authenticate(
  lookup: UserLookup,
  verify: PasswordVerify,
  username: string,
  password: string,
): Promise<AuthUserRecord | null> {
  const user = await lookup(username);
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verify(password, hashToCheck);
  if (!user || !user.isActive || !ok) return null;
  return user;
}
