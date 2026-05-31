"use client";

import { useActionState } from "react";
import { assignUserAction, removeAssignmentAction, type AssignmentFormState } from "@/lib/warehouses/assignments";
import { siteRoleLabel, SITE_ROLES } from "@/lib/warehouses/roles";

interface AssignmentRow {
  id: string;
  siteRole: string;
  userFullName: string;
  username: string;
}
interface Props {
  warehouseId: string;
  users: { id: string; fullName: string; username: string }[];
  assignments: AssignmentRow[];
}

const initial: AssignmentFormState = {};

export function AssignmentsManager({ warehouseId, users, assignments }: Props) {
  const [state, action, pending] = useActionState(assignUserAction, initial);

  return (
    <section className="bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="font-semibold">Nhân sự phụ trách</h2>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có ai được phân công.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr><th className="py-1">Họ tên</th><th className="py-1">Tài khoản</th><th className="py-1">Vai trò</th><th></th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2">{a.userFullName}</td>
                <td className="py-2">{a.username}</td>
                <td className="py-2">{siteRoleLabel[a.siteRole]}</td>
                <td className="py-2 text-right">
                  <form action={removeAssignmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="warehouseId" value={warehouseId} />
                    <button type="submit" className="text-red-600 hover:underline">Gỡ</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-4">
        <input type="hidden" name="warehouseId" value={warehouseId} />
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="userId">Người dùng</label>
          <select id="userId" name="userId" required className="border rounded-lg px-3 py-2 text-sm">
            <option value="">— Chọn —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="siteRole">Vai trò</label>
          <select id="siteRole" name="siteRole" required className="border rounded-lg px-3 py-2 text-sm">
            <option value="">— Chọn —</option>
            {SITE_ROLES.map((r) => (
              <option key={r} value={r}>{siteRoleLabel[r]}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang thêm..." : "Phân công"}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
