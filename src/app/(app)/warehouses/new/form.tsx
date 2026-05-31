"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createWarehouseAction, type WarehouseFormState } from "@/lib/warehouses/actions";

const initial: WarehouseFormState = {};

export function WarehouseCreateForm() {
  const [state, action, pending] = useActionState(createWarehouseAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="code">Mã công trình/kho</label>
        <input id="code" name="code" required autoComplete="off" className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên công trình</label>
        <input id="name" name="name" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="type">Loại</label>
        <select id="type" name="type" defaultValue="PROJECT" className="w-full border rounded-lg px-3 py-2">
          <option value="PROJECT">Công trình</option>
          <option value="CENTRAL">Kho tổng</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="address">Địa chỉ (tùy chọn)</label>
        <input id="address" name="address" className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/warehouses" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
