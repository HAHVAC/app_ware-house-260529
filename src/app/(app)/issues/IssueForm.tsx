"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { IssueFormState } from "@/lib/inventory/issue-actions";

const initial: IssueFormState = {};

interface WarehouseOpt { id: string; code: string; name: string; }
interface MaterialOpt { id: string; code: string; name: string; unit: string; }
interface LineInit { materialId: string; qty: number; }

type Action = (prev: IssueFormState, formData: FormData) => Promise<IssueFormState>;

export function IssueForm({
  action,
  materials,
  warehouses,
  fixedWarehouse,
  documentId,
  initialLines,
  initialRecipient,
  initialNote,
}: {
  action: Action;
  materials: MaterialOpt[];
  warehouses?: WarehouseOpt[];
  fixedWarehouse?: WarehouseOpt;
  documentId?: string;
  initialLines?: LineInit[];
  initialRecipient?: string | null;
  initialNote?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const seed = initialLines && initialLines.length > 0 ? initialLines : [{ materialId: "", qty: 0 }];
  const [rows, setRows] = useState(seed.map((l, i) => ({ key: i, ...l })));
  const [nextKey, setNextKey] = useState(seed.length);

  const addRow = () => { setRows((r) => [...r, { key: nextKey, materialId: "", qty: 0 }]); setNextKey((n) => n + 1); };
  const removeRow = (key: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

  return (
    <form action={formAction} className="bg-white rounded-xl shadow p-6 space-y-4">
      {documentId && <input type="hidden" name="id" value={documentId} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="warehouseId">Công trình / Kho</label>
          {fixedWarehouse ? (
            <input className="w-full border rounded-lg px-3 py-2 bg-gray-50" value={`${fixedWarehouse.code} — ${fixedWarehouse.name}`} disabled />
          ) : (
            <select id="warehouseId" name="warehouseId" required className="w-full border rounded-lg px-3 py-2">
              {(warehouses ?? []).map((w) => (<option key={w.id} value={w.id}>{w.code} — {w.name}</option>))}
            </select>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="recipient">Người nhận (tùy chọn)</label>
          <input id="recipient" name="recipient" defaultValue={initialRecipient ?? ""} className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vật tư đề nghị xuất</span>
          <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm dòng</button>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
            <select name={`material_${row.key}`} defaultValue={row.materialId} className="col-span-8 border rounded-lg px-2 py-2 text-sm">
              <option value="">— Chọn vật tư —</option>
              {materials.map((m) => (<option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>))}
            </select>
            <input name={`qty_${row.key}`} type="number" min="0" step="any" defaultValue={row.qty || ""} placeholder="SL" className="col-span-3 border rounded-lg px-2 py-2 text-sm" />
            <button type="button" onClick={() => removeRow(row.key)} className="col-span-1 text-red-500 text-sm">×</button>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Lý do / mục đích xuất (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} defaultValue={initialNote ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu đề nghị"}
        </button>
        <Link href={documentId ? `/issues/${documentId}` : "/issues"} className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
