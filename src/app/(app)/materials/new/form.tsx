"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMaterialAction, type MaterialFormState } from "@/lib/materials/actions";

const initial: MaterialFormState = {};

function Field({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <input id={id} name={id} required={required} className="w-full border rounded-lg px-3 py-2" />
    </div>
  );
}

export function MaterialCreateForm() {
  const [state, action, pending] = useActionState(createMaterialAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <Field id="code" label="Mã vật tư" required />
      <Field id="name" label="Tên vật tư" required />
      <Field id="unit" label="Đơn vị tính" required />
      <Field id="categoryName" label="Nhóm vật tư (tùy chọn)" />
      <Field id="modelCode" label="Mã hiệu (tùy chọn)" />
      <Field id="brandOrigin" label="Nhãn hiệu / Xuất xứ (tùy chọn)" />
      <Field id="specification" label="Thông số kỹ thuật (tùy chọn)" />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="latestUnitPrice">Đơn giá tham khảo - VND (tùy chọn)</label>
        <input id="latestUnitPrice" name="latestUnitPrice" type="number" min="0" step="any" className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/materials" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
