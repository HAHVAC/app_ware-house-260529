import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const typeLabel: Record<string, string> = { PROJECT: "Công trình", CENTRAL: "Kho tổng" };

export default async function WarehousesPage() {
  await requireAdmin();
  const warehouses = await db.warehouse.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Công trình / Kho</h1>
        <Link href="/warehouses/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
          + Thêm công trình
        </Link>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Nhân sự</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="px-3 py-2 font-mono">{w.code}</td>
                <td className="px-3 py-2">{w.name}</td>
                <td className="px-3 py-2">{typeLabel[w.type]}</td>
                <td className="px-3 py-2">{w._count.assignments}</td>
                <td className="px-3 py-2">
                  {w.status === "ACTIVE"
                    ? <span className="text-green-600">Đang hoạt động</span>
                    : <span className="text-gray-400">Đã đóng</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/warehouses/${w.id}`} className="text-blue-600 hover:underline">Sửa / Phân công</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
