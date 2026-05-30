"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authenticate } from "@/lib/auth/authenticate";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Vui lòng nhập tài khoản và mật khẩu" };
  }

  const user = await authenticate(
    (u) => db.user.findUnique({ where: { username: u } }),
    verifyPassword,
    username,
    password,
  );

  if (!user) {
    return { error: "Sai tài khoản hoặc mật khẩu" };
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  redirect("/");
}
