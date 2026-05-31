"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeIssueAction, type IssueFormState } from "@/lib/inventory/issue-actions";

const initial: IssueFormState = {};

interface LineView { id: string; code: string; name: string; unit: string; requestedQty: number; }

export function CompleteForm({ documentId, lines }: { documentId: string; lines: LineView[] }) {
  const [state, action, pending] = useActionState(completeIssueAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={documentId} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">SL đề nghị</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">SL thực xuất</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.code}</td>
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2 text-right">{l.requestedQty.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2 text-right">
                  <input name={`actual_${l.id}`} type="number" min="0" step="any" defaultValue={l.requestedQty} className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="reason">Lý do chênh lệch (bắt buộc nếu thực xuất khác đề nghị)</label>
        <textarea id="reason" name="reason" rows={2} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang xuất..." : "Xác nhận xuất kho"}
        </button>
        <Link href={`/issues/${documentId}`} className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
