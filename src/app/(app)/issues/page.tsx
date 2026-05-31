import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã xuất", cls: "text-green-600" },
  REJECTED: { label: "Từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function IssuesPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);
  const issues = await db.document.findMany({
    where: { type: "ISSUE", ...(scope === "ALL" ? {} : { warehouseId: { in: scope } }) },
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { lines: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu xuất kho</h1>
        <Link href="/issues/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập đề nghị xuất</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày lập</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {issues.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code} — {d.warehouse.name}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2"><span className={STATUS[d.status]?.cls}>{STATUS[d.status]?.label}</span></td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/issues/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu xuất nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
