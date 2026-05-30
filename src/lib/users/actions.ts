"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { validateUserInput, type CompanyRoleInput } from "./validate";

export interface UserFormState {
  error?: string;
}

function readRole(formData: FormData): CompanyRoleInput {
  const raw = String(formData.get("companyRole") ?? "");
  return raw === "ADMIN" || raw === "ACCOUNTANT" ? raw : null;
}

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyRole = readRole(formData);

  const v = validateUserInput({ fullName, username, password, companyRole });
  if (!v.ok) return { error: v.error };

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return { error: "Tài khoản đã tồn tại" };

  await db.user.create({
    data: { fullName, username, passwordHash: await hashPassword(password), companyRole },
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? ""); // rỗng = không đổi
  const companyRole = readRole(formData);
  const isActive = formData.get("isActive") === "on";

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy người dùng" };

  const v = validateUserInput(
    { fullName, username: target.username, password, companyRole },
    { requirePassword: false },
  );
  if (!v.ok) return { error: v.error };

  if (admin.id === id && !isActive) {
    return { error: "Không thể tự vô hiệu hóa tài khoản đang đăng nhập" };
  }

  await db.user.update({
    where: { id },
    data: {
      fullName,
      companyRole,
      isActive,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  revalidatePath("/users");
  redirect("/users");
}
