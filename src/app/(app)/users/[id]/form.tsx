"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateUserAction, type UserFormState } from "@/lib/users/actions";

interface Props {
  user: {
    id: string;
    fullName: string;
    username: string;
    companyRole: "ADMIN" | "ACCOUNTANT" | null;
    isActive: boolean;
  };
}

const initial: UserFormState = {};

export function UserEditForm({ user }: Props) {
  const [state, action, pending] = useActionState(updateUserAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={user.id} />

      <div className="space-y-1">
        <label className="text-sm font-medium">Tài khoản</label>
        <input value={user.username} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fullName">Họ tên</label>
        <input id="fullName" name="fullName" required defaultValue={user.fullName}
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Mật khẩu mới (để trống nếu không đổi)</label>
        <input id="password" name="password" type="password" autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="companyRole">Vai trò công ty</label>
        <select id="companyRole" name="companyRole" defaultValue={user.companyRole ?? ""}
          className="w-full border rounded-lg px-3 py-2">
          <option value="">— Không (chỉ vai trò tại kho) —</option>
          <option value="ADMIN">Quản lý</option>
          <option value="ACCOUNTANT">Kế toán/Mua hàng</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
        Đang hoạt động
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/users" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
