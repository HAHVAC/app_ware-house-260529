import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canModifyPendingIssue } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { updateIssueAction } from "@/lib/inventory/issue-actions";
import { IssueForm } from "../../IssueForm";

export default async function EditIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: { warehouse: { select: { id: true, code: true, name: true } }, lines: true },
  });
  if (!doc || doc.type !== "ISSUE") notFound();
  if (!canModifyPendingIssue(user, doc)) redirect(`/issues/${id}`);

  const materials = await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Sửa đề nghị xuất {doc.code}</h1>
      <IssueForm
        action={updateIssueAction}
        materials={materials}
        fixedWarehouse={doc.warehouse}
        documentId={doc.id}
        initialLines={doc.lines.map((l) => ({ materialId: l.materialId, qty: Number(l.requestedQty) }))}
        initialRecipient={doc.recipient}
        initialNote={doc.note}
      />
    </div>
  );
}
