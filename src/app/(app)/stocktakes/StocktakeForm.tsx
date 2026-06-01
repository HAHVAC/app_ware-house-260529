"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AdjustmentFormState } from "@/lib/inventory/adjustment-actions";

const initial: AdjustmentFormState = {};

interface MaterialOpt { id: string; code: string; name: string; unit: string; }
interface PresetLine { materialId: string; code: string; name: string; unit: string; systemQty: number; countedQty: number; }

type Action = (prev: AdjustmentFormState, formData: FormData) => Promise<AdjustmentFormState>;

export function StocktakeForm({
  action,
  warehouse,
  presetLines,
  materials,
  documentId,
  initialNote,
}: {
  action: Action;
  warehouse: { id: string; code: string; name: string };
  presetLines: PresetLine[];
  materials: MaterialOpt[];
  documentId?: string;
  initialNote?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  // Dòng nạp sẵn (vật tư cố định) + dòng thêm mới (chọn vật tư).
  const [preset] = useState(presetLines.map((l, i) => ({ key: i, ...l })));
  const [extra, setExtra] = useState<{ key: number }[]>([]);
  const [nextKey, setNextKey] = useState(presetLines.length);

  const addRow = () => { setExtra((r) => [...r, { key: nextKey }]); setNextKey((n) => n + 1); };
  const removeRow = (key: number) => setExtra((r) => r.filter((x) => x.key !== key));

  return (
    <form action={formAction} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="warehouseId" value={warehouse.id} />
      {documentId && <input type="hidden" name="id" value={documentId} />}

      <p className="text-sm text-gray-600">Kho: <b>{warehouse.code} — {warehouse.name}</b></p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Tồn hệ thống</th>
              <th className="px-3 py-2 text-right">Số đếm thực tế</th>
            </tr>
          </thead>
          <tbody>
            {preset.map((l) => (
              <tr key={l.key} className="border-t">
                <td className="px-3 py-2 font-mono">{l.code}</td>
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2 text-right">{l.systemQty.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">
                  <input type="hidden" name={`material_${l.key}`} value={l.materialId} />
                  <input name={`counted_${l.key}`} type="number" min="0" step="any" defaultValue={l.countedQty} className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right" />
                </td>
              </tr>
            ))}
            {extra.map((row) => (
              <tr key={row.key} className="border-t bg-amber-50">
                <td className="px-3 py-2" colSpan={3}>
                  <select name={`material_${row.key}`} className="w-full border rounded-lg px-2 py-1.5 text-sm">
                    <option value="">— Chọn vật tư thêm —</option>
                    {materials.map((m) => (<option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-gray-400">0</td>
                <td className="px-3 py-2 text-right flex items-center gap-1 justify-end">
                  <input name={`counted_${row.key}`} type="number" min="0" step="any" defaultValue={0} className="w-24 border rounded-lg px-2 py-1.5 text-sm text-right" />
                  <button type="button" onClick={() => removeRow(row.key)} className="text-red-500 text-sm">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm vật tư chưa có trong danh sách</button>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Ghi chú (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} defaultValue={initialNote ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phiếu kiểm kê"}
        </button>
        <Link href={documentId ? `/stocktakes/${documentId}` : "/stocktakes"} className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
