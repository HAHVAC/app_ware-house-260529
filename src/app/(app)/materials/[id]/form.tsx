"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateMaterialAction, type MaterialFormState } from "@/lib/materials/actions";

interface Props {
  material: {
    id: string; code: string; name: string; unit: string;
    categoryName: string; modelCode: string; brandOrigin: string;
    specification: string; price: string; isActive: boolean;
  };
}

const initial: MaterialFormState = {};

export function MaterialEditForm({ material }: Props) {
  const [state, action, pending] = useActionState(updateMaterialAction, initial);
  const m = material;

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={m.id} />
      <div className="space-y-1">
        <label className="text-sm font-medium">Mã vật tư</label>
        <input value={m.code} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 font-mono" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên vật tư</label>
        <input id="name" name="name" required defaultValue={m.name} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="unit">Đơn vị tính</label>
        <input id="unit" name="unit" required defaultValue={m.unit} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="categoryName">Nhóm vật tư</label>
        <input id="categoryName" name="categoryName" defaultValue={m.categoryName} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="modelCode">Mã hiệu</label>
        <input id="modelCode" name="modelCode" defaultValue={m.modelCode} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="brandOrigin">Nhãn hiệu / Xuất xứ</label>
        <input id="brandOrigin" name="brandOrigin" defaultValue={m.brandOrigin} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="specification">Thông số kỹ thuật</label>
        <input id="specification" name="specification" defaultValue={m.specification} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="latestUnitPrice">Đơn giá tham khảo - VND</label>
        <input id="latestUnitPrice" name="latestUnitPrice" type="number" min="0" step="any" defaultValue={m.price} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={m.isActive} />
        Đang dùng
      </label>

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
