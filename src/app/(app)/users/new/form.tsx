"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createUserAction, type UserFormState } from "@/lib/users/actions";

const initial: UserFormState = {};

export function UserCreateForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fullName">Họ tên</label>
        <input id="fullName" name="fullName" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="username">Tài khoản</label>
        <input id="username" name="username" required autoComplete="off" className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="companyRole">Vai trò công ty</label>
        <select id="companyRole" name="companyRole" className="w-full border rounded-lg px-3 py-2" defaultValue="">
          <option value="">— Không (chỉ vai trò tại kho) —</option>
          <option value="ADMIN">Quản lý</option>
          <option value="ACCOUNTANT">Kế toán/Mua hàng</option>
        </select>
      </div>

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
