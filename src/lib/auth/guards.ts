import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";

/** Trả về user đang đăng nhập, hoặc chuyển hướng /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Trả về user nếu là ADMIN, ngược lại chuyển về trang chủ. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.companyRole !== "ADMIN") redirect("/");
  return user;
}
