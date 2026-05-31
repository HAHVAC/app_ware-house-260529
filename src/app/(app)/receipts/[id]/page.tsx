import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "RECEIPT") notFound();

  const scope = await viewableWarehouseIds(user);
  if (scope !== "ALL" && !scope.includes(doc.warehouseId)) redirect("/");

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu nhập {doc.code}</h1>
        <Link href="/receipts" className="text-sm text-gray-600">← Danh sách</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-1">
        <div><span className="text-gray-500">Kho:</span> {doc.warehouse.code} — {doc.warehouse.name}</div>
        <div><span className="text-gray-500">Ngày nhập:</span> {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        <div><span className="text-gray-500">Người lập:</span> {doc.createdBy.fullName}</div>
        {doc.note && <div><span className="text-gray-500">Ghi chú:</span> {doc.note}</div>}
        <div><span className="text-gray-500">Trạng thái:</span> <span className="text-green-600">Đã hoàn thành (đã khóa)</span></div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">Số lượng</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.material.code}</td>
                <td className="px-3 py-2">{l.material.name}</td>
                <td className="px-3 py-2 text-right">{Number(l.requestedQty).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{l.material.unit}</td>
                <td className="px-3 py-2 text-right">
                  {l.unitPrice != null ? Number(l.unitPrice).toLocaleString("vi-VN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Phiếu nhập có hiệu lực ngay khi lập và không thể sửa/xóa. Sai sót xử lý bằng phiếu kiểm kê/điều chỉnh (kế hoạch sau).</p>
    </div>
  );
}
