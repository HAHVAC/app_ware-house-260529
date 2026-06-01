import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { updateAdjustmentAction } from "@/lib/inventory/adjustment-actions";
import { StocktakeForm } from "../../StocktakeForm";

export default async function EditStocktakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: { include: { material: { select: { id: true, code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "ADJUSTMENT") notFound();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);

  // Lấy tồn hệ thống hiện tại để hiển thị cột "tồn hệ thống".
  const stocks = await db.stock.findMany({ where: { warehouseId: doc.warehouseId } });
  const sysQty = new Map(stocks.map((s) => [s.materialId, Number(s.quantity)]));

  const presetLines = doc.lines.map((l) => ({
    materialId: l.materialId,
    code: l.material.code,
    name: l.material.name,
    unit: l.material.unit,
    systemQty: sysQty.get(l.materialId) ?? 0,
    countedQty: l.countedQty != null ? Number(l.countedQty) : 0,
  }));
  const presetIds = new Set(presetLines.map((l) => l.materialId));
  const materials = (await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  })).filter((m) => !presetIds.has(m.id));

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold">Sửa phiếu kiểm kê {doc.code}</h1>
      <StocktakeForm
        action={updateAdjustmentAction}
        warehouse={{ id: doc.warehouseId, code: doc.warehouse.code, name: doc.warehouse.name }}
        presetLines={presetLines}
        materials={materials}
        documentId={doc.id}
        initialNote={doc.note}
      />
    </div>
  );
}
