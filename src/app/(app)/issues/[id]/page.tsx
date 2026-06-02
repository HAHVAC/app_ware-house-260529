import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { canApproveIssue, canCompleteIssue, canModifyPendingIssue } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { approveIssueAction, rejectIssueAction, cancelIssueAction } from "@/lib/inventory/issue-actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt — chờ thủ kho xuất", cls: "text-blue-600" },
  COMPLETED: { label: "Đã xuất (đã khóa)", cls: "text-green-600" },
  REJECTED: { label: "Đã từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
      completedBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "ISSUE") notFound();

  const scope = await viewableWarehouseIds(user);
  if (scope !== "ALL" && !scope.includes(doc.warehouseId)) redirect("/");

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  const showModify = canModifyPendingIssue(user, doc);
  const showApprove = doc.status === "PENDING" && canApproveIssue(user, assignments, doc.warehouseId, doc.createdById);
  const showComplete = doc.status === "APPROVED" && canCompleteIssue(user, assignments, doc.warehouseId);
  const completed = doc.status === "COMPLETED";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu xuất {doc.code}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/documents/${doc.id}/print`} target="_blank" className="text-sm text-blue-600 hover:underline">In phiếu</Link>
          <Link href="/issues" className="text-sm text-gray-600">← Danh sách</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-1">
        <div><span className="text-gray-500">Kho:</span> {doc.warehouse.code} — {doc.warehouse.name}</div>
        <div><span className="text-gray-500">Ngày lập:</span> {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        <div><span className="text-gray-500">Người lập:</span> {doc.createdBy.fullName}</div>
        {doc.recipient && <div><span className="text-gray-500">Người nhận:</span> {doc.recipient}</div>}
        {doc.note && <div><span className="text-gray-500">Lý do/mục đích:</span> {doc.note}</div>}
        {doc.approvedBy && <div><span className="text-gray-500">Người duyệt:</span> {doc.approvedBy.fullName}</div>}
        {doc.completedBy && <div><span className="text-gray-500">Người thực xuất:</span> {doc.completedBy.fullName}</div>}
        {doc.status === "REJECTED" && doc.reason && <div><span className="text-gray-500">Lý do từ chối:</span> {doc.reason}</div>}
        {completed && doc.reason && <div><span className="text-gray-500">Lý do chênh lệch:</span> {doc.reason}</div>}
        <div><span className="text-gray-500">Trạng thái:</span> <span className={STATUS[doc.status]?.cls}>{STATUS[doc.status]?.label}</span></div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">SL đề nghị</th>
              <th className="px-3 py-2 text-right">SL thực xuất</th>
              <th className="px-3 py-2">ĐVT</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.material.code}</td>
                <td className="px-3 py-2">{l.material.name}</td>
                <td className="px-3 py-2 text-right">{Number(l.requestedQty).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">{l.actualQty != null ? Number(l.actualQty).toLocaleString("vi-VN") : "—"}</td>
                <td className="px-3 py-2">{l.material.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {showModify && (
          <>
            <Link href={`/issues/${doc.id}/edit`} className="border rounded-lg px-4 py-2 text-sm">Sửa</Link>
            <form action={cancelIssueAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="text-red-600 text-sm hover:underline" type="submit">Hủy phiếu</button>
            </form>
          </>
        )}
        {showApprove && (
          <>
            <form action={approveIssueAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Duyệt</button>
            </form>
            <form action={rejectIssueAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={doc.id} />
              <input name="reason" placeholder="Lý do từ chối" className="border rounded-lg px-2 py-1.5 text-sm" />
              <button className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm" type="submit">Từ chối</button>
            </form>
          </>
        )}
        {showComplete && (
          <Link href={`/issues/${doc.id}/complete`} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">Ghi thực xuất</Link>
        )}
      </div>
    </div>
  );
}
