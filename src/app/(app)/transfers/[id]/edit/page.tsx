import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { updateTransferAction } from "@/lib/inventory/transfer-actions";
import { TransferForm } from "../../TransferForm";

export default async function EditTransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: { warehouse: { select: { code: true, name: true } }, lines: true },
  });
  if (!doc || doc.type !== "TRANSFER") notFound();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);

  const targets = await db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const materials = await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Sửa phiếu điều chuyển {doc.code}</h1>
      <TransferForm
        action={updateTransferAction}
        materials={materials}
        targetWarehouses={targets}
        fixedSource={{ id: doc.warehouseId, code: doc.warehouse.code, name: doc.warehouse.name }}
        documentId={doc.id}
        initialTargetId={doc.targetWarehouseId}
        initialLines={doc.lines.map((l) => ({ materialId: l.materialId, qty: Number(l.requestedQty) }))}
        initialNote={doc.note}
      />
    </div>
  );
}
