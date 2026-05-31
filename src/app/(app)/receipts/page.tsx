import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function ReceiptsPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const receipts = await db.document.findMany({
    where: {
      type: "RECEIPT",
      ...(scope === "ALL" ? {} : { warehouseId: { in: scope } }),
    },
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
        <h1 className="text-lg font-semibold">Phiếu nhập kho</h1>
        <Link href="/receipts/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập phiếu nhập</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày nhập</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code} — {d.warehouse.name}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/receipts/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu nhập nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
