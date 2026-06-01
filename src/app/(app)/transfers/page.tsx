import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã chuyển", cls: "text-green-600" },
  REJECTED: { label: "Từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function TransfersPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);
  // Hiện phiếu mà user thấy kho nguồn HOẶC kho đích.
  const whereScope =
    scope === "ALL"
      ? {}
      : { OR: [{ warehouseId: { in: scope } }, { targetWarehouseId: { in: scope } }] };
  const rows = await db.document.findMany({
    where: { type: "TRANSFER", ...whereScope },
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: { select: { code: true, name: true } },
      targetWarehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { lines: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu điều chuyển</h1>
        <Link href="/transfers/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập điều chuyển</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày lập</th>
              <th className="px-3 py-2">Kho nguồn</th>
              <th className="px-3 py-2">Kho đích</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code}</td>
                <td className="px-3 py-2">{d.targetWarehouse?.code ?? "—"}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2"><span className={STATUS[d.status]?.cls}>{STATUS[d.status]?.label}</span></td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/transfers/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu điều chuyển nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
