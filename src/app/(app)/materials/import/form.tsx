"use client";

import { useActionState } from "react";
import { importMaterialsAction, type ImportState } from "@/lib/materials/import-actions";

const initial: ImportState = {};

export function ImportForm() {
  const [state, action, pending] = useActionState(importMaterialsAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
        <input type="file" name="file" accept=".xlsx" required className="block w-full text-sm" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang nhập..." : "Tải lên & nhập"}
        </button>
      </form>

      {state.summary && (
        <div className="bg-white rounded-xl shadow p-6 space-y-2 text-sm">
          <p className="text-green-700">Tạo mới: {state.summary.created} · Cập nhật: {state.summary.updated} · Lỗi: {state.summary.errors.length}</p>
          {state.summary.errors.length > 0 && (
            <ul className="list-disc pl-5 text-red-600">
              {state.summary.errors.map((e, idx) => (
                <li key={idx}>Dòng {e.line}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
