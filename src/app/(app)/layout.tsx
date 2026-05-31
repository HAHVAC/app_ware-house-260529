import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logoutAction } from "./actions";

const roleLabel: Record<string, string> = {
  ADMIN: "Quản lý",
  ACCOUNTANT: "Kế toán/Mua hàng",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.companyRole === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Quản lý Kho</span>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-gray-700 hover:text-blue-600">Tổng quan</Link>
            {isAdmin && (
              <Link href="/users" className="text-gray-700 hover:text-blue-600">Người dùng</Link>
            )}
            {isAdmin && (
              <Link href="/warehouses" className="text-gray-700 hover:text-blue-600">Công trình</Link>
            )}
            {isAdmin && (
              <Link href="/materials" className="text-gray-700 hover:text-blue-600">Vật tư</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {user.fullName}
            {user.companyRole ? ` · ${roleLabel[user.companyRole] ?? ""}` : ""}
          </span>
          <form action={logoutAction}>
            <button className="text-blue-600 hover:underline" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
