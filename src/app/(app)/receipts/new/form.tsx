"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createReceiptAction, type ReceiptFormState } from "@/lib/inventory/receipt-actions";

const initial: ReceiptFormState = {};

interface WarehouseOpt { id: string; code: string; name: string; }
interface MaterialOpt { id: string; code: string; name: string; unit: string; }

export function ReceiptCreateForm({
  warehouses,
  materials,
  today,
}: {
  warehouses: WarehouseOpt[];
  materials: MaterialOpt[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createReceiptAction, initial);
  const [rows, setRows] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  const addRow = () => {
    setRows((r) => [...r, nextId]);
    setNextId((n) => n + 1);
  };
  const removeRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r));

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="warehouseId">Công trình / Kho</label>
          <select id="warehouseId" name="warehouseId" required className="w-full border rounded-lg px-3 py-2">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="documentDate">Ngày nhập</label>
          <input id="documentDate" name="documentDate" type="date" defaultValue={today} required className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vật tư</span>
          <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm dòng</button>
        </div>
        <div className="space-y-2">
          {rows.map((id) => (
            <div key={id} className="grid grid-cols-12 gap-2 items-center">
              <select name={`material_${id}`} className="col-span-6 border rounded-lg px-2 py-2 text-sm">
                <option value="">— Chọn vật tư —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>
                ))}
              </select>
              <input name={`qty_${id}`} type="number" min="0" step="any" placeholder="SL" className="col-span-2 border rounded-lg px-2 py-2 text-sm" />
              <input name={`price_${id}`} type="number" min="0" step="any" placeholder="Đơn giá" className="col-span-3 border rounded-lg px-2 py-2 text-sm" />
              <button type="button" onClick={() => removeRow(id)} className="col-span-1 text-red-500 text-sm">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Ghi chú (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phiếu nhập"}
        </button>
        <Link href="/receipts" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
