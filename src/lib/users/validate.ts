export type CompanyRoleInput = "ADMIN" | "ACCOUNTANT" | null;

export interface UserInput {
  fullName: string;
  username: string;
  password: string;
  companyRole: CompanyRoleInput;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 6;
const VALID_ROLES = ["ADMIN", "ACCOUNTANT"];

export function validateUserInput(
  input: UserInput,
  opts: { requirePassword?: boolean } = {},
): ValidateResult {
  const { requirePassword = true } = opts;

  if (!input.fullName || !input.fullName.trim()) {
    return { ok: false, error: "Vui lòng nhập họ tên" };
  }
  if (!input.username || !input.username.trim()) {
    return { ok: false, error: "Vui lòng nhập tài khoản" };
  }
  if (/\s/.test(input.username)) {
    return { ok: false, error: "Tài khoản không được chứa khoảng trắng" };
  }
  if (requirePassword || input.password) {
    if (input.password.length < MIN_PASSWORD) {
      return { ok: false, error: `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự` };
    }
  }
  if (input.companyRole !== null && !VALID_ROLES.includes(input.companyRole)) {
    return { ok: false, error: "Vai trò không hợp lệ" };
  }
  return { ok: true };
}
