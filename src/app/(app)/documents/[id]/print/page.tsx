import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { PrintButton } from "./PrintButton";

const DOC_TITLE: Record<string, string> = {
  RECEIPT: "PHIẾU NHẬP KHO", ISSUE: "PHIẾU XUẤT KHO",
  TRANSFER: "PHIẾU ĐIỀU CHUYỂN", ADJUSTMENT: "PHIẾU KIỂM KÊ",
};
// Nhãn chữ ký theo loại phiếu.
const SIGN: Record<string, string[]> = {
  RECEIPT: ["Người lập phiếu", "Thủ kho"],
  ISSUE: ["Người lập phiếu", "Người duyệt", "Thủ kho", "Người nhận"],
  TRANSFER: ["Người lập phiếu", "Người duyệt", "Thủ kho kho nguồn", "Thủ kho kho đích"],
  ADJUSTMENT: ["Người lập phiếu", "Người duyệt", "Thủ kho"],
};

function qtyOf(type: string, line: { requestedQty: unknown; actualQty: unknown; countedQty: unknown }): number {
  if (type === "ISSUE") return Number(line.actualQty ?? line.requestedQty);
  if (type === "ADJUSTMENT") return Number(line.countedQty ?? 0);
  return Number(line.requestedQty);
}

export default async function PrintDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      targetWarehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc) notFound();

  const scope = await viewableWarehouseIds(user);
  const canView = scope === "ALL" || scope.includes(doc.warehouseId) || (doc.targetWarehouseId != null && scope.includes(doc.targetWarehouseId));
  if (!canView) redirect("/");

  const signers = SIGN[doc.type] ?? ["Người lập phiếu"];

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 text-sm text-black">
      <div className="flex justify-end mb-4"><PrintButton /></div>

      <div className="text-center space-y-1 mb-6">
        <div className="font-semibold uppercase">Công ty [Tên công ty]</div>
        <div className="text-xs text-gray-600">PCCC &amp; Cơ điện</div>
        <h1 className="text-xl font-bold mt-3">{DOC_TITLE[doc.type] ?? "PHIẾU KHO"}</h1>
        <div className="font-mono">Số: {doc.code}</div>
      </div>

      <div className="space-y-1 mb-4">
        <div>Ngày: {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        {doc.type === "TRANSFER" ? (
          <div>Từ kho: <b>{doc.warehouse.code} — {doc.warehouse.name}</b> → Đến kho: <b>{doc.targetWarehouse?.code} — {doc.targetWarehouse?.name}</b></div>
        ) : (
          <div>Kho: <b>{doc.warehouse.code} — {doc.warehouse.name}</b></div>
        )}
        <div>Người lập: {doc.createdBy.fullName}</div>
        {doc.recipient && <div>Người nhận: {doc.recipient}</div>}
        {doc.note && <div>Ghi chú: {doc.note}</div>}
        {doc.reason && <div>Lý do: {doc.reason}</div>}
      </div>

      <table className="w-full border-collapse mb-8">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">STT</th>
            <th className="border px-2 py-1 text-left">Mã VT</th>
            <th className="border px-2 py-1 text-left">Tên vật tư</th>
            <th className="border px-2 py-1 text-left">ĐVT</th>
            <th className="border px-2 py-1 text-right">Số lượng</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="border px-2 py-1">{i + 1}</td>
              <td className="border px-2 py-1 font-mono">{l.material.code}</td>
              <td className="border px-2 py-1">{l.material.name}</td>
              <td className="border px-2 py-1">{l.material.unit}</td>
              <td className="border px-2 py-1 text-right">{qtyOf(doc.type, l).toLocaleString("vi-VN")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${signers.length}, minmax(0, 1fr))` }}>
        {signers.map((s) => (
          <div key={s} className="text-center">
            <div className="font-medium">{s}</div>
            <div className="text-xs text-gray-500">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
