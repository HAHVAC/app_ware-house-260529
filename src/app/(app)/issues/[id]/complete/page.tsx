import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canCompleteIssue } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { CompleteForm } from "./CompleteForm";

export default async function CompleteIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "ISSUE") notFound();

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  if (!canCompleteIssue(user, assignments, doc.warehouseId)) redirect(`/issues/${id}`);
  if (doc.status !== "APPROVED") redirect(`/issues/${id}`);

  const lines = doc.lines.map((l) => ({
    id: l.id,
    code: l.material.code,
    name: l.material.name,
    unit: l.material.unit,
    requestedQty: Number(l.requestedQty),
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Ghi thực xuất — {doc.code}</h1>
      <p className="text-sm text-gray-600">Kho: {doc.warehouse.code} — {doc.warehouse.name}</p>
      <CompleteForm documentId={doc.id} lines={lines} />
    </div>
  );
}
