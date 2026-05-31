"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateWarehouseAction, type WarehouseFormState } from "@/lib/warehouses/actions";

interface Props {
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: "PROJECT" | "CENTRAL";
    address: string | null;
    status: "ACTIVE" | "CLOSED";
  };
}

const initial: WarehouseFormState = {};

export function WarehouseEditForm({ warehouse }: Props) {
  const [state, action, pending] = useActionState(updateWarehouseAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={warehouse.id} />
      <div className="space-y-1">
        <label className="text-sm font-medium">Mã công trình/kho</label>
        <input value={warehouse.code} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 font-mono" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên công trình</label>
        <input id="name" name="name" required defaultValue={warehouse.name} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="type">Loại</label>
        <select id="type" name="type" defaultValue={warehouse.type} className="w-full border rounded-lg px-3 py-2">
          <option value="PROJECT">Công trình</option>
          <option value="CENTRAL">Kho tổng</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="address">Địa chỉ (tùy chọn)</label>
        <input id="address" name="address" defaultValue={warehouse.address ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="status">Trạng thái</label>
        <select id="status" name="status" defaultValue={warehouse.status} className="w-full border rounded-lg px-3 py-2">
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/warehouses" className="px-4 py-2 text-sm text-gray-600">Quay lại</Link>
      </div>
    </form>
  );
}
