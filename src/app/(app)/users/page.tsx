import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const roleLabel: Record<string, string> = {
  ADMIN: "Quản lý",
  ACCOUNTANT: "Kế toán/Mua hàng",
};

export default async function UsersPage() {
  await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Người dùng</h1>
        <Link href="/users/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
          + Thêm người dùng
        </Link>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Tài khoản</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.companyRole ? roleLabel[u.companyRole] : "—"}</td>
                <td className="px-3 py-2">
                  {u.isActive
                    ? <span className="text-green-600">Đang hoạt động</span>
                    : <span className="text-gray-400">Đã khóa</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/users/${u.id}`} className="text-blue-600 hover:underline">Sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
