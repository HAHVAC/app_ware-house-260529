import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export default async function MaterialsPage() {
  await requireAdmin();
  const materials = await db.material.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Danh mục vật tư</h1>
        <div className="flex gap-2">
          <Link href="/materials/import" className="border rounded-lg px-3 py-2 text-sm">Nhập từ Excel</Link>
          <Link href="/materials/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Thêm vật tư</Link>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Nhóm</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-mono">{m.code}</td>
                <td className="px-3 py-2">{m.name}</td>
                <td className="px-3 py-2">{m.categoryName ?? "—"}</td>
                <td className="px-3 py-2">{m.unit}</td>
                <td className="px-3 py-2 text-right">
                  {m.latestUnitPrice != null ? Number(m.latestUnitPrice).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-2">
                  {m.isActive ? <span className="text-green-600">Đang dùng</span> : <span className="text-gray-400">Đã ẩn</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/materials/${m.id}`} className="text-blue-600 hover:underline">Sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
