"use client";

interface Opt { id: string; code: string; name: string; }

export function HistoryFilters({
  warehouses, materials, current,
}: {
  warehouses: Opt[];
  materials: { id: string; code: string; name: string }[];
  current: { from?: string; to?: string; w?: string; m?: string; type?: string };
}) {
  return (
    <form method="get" className="bg-white rounded-xl shadow p-4 grid sm:grid-cols-3 gap-3 text-sm">
      <div className="space-y-1">
        <label className="text-gray-600">Từ ngày</label>
        <input type="date" name="from" defaultValue={current.from ?? ""} className="w-full border rounded-lg px-2 py-1.5" />
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Đến ngày</label>
        <input type="date" name="to" defaultValue={current.to ?? ""} className="w-full border rounded-lg px-2 py-1.5" />
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Loại phiếu</label>
        <select name="type" defaultValue={current.type ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          <option value="RECEIPT">Nhập</option>
          <option value="ISSUE">Xuất</option>
          <option value="TRANSFER">Điều chuyển</option>
          <option value="ADJUSTMENT">Kiểm kê</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Kho</label>
        <select name="w" defaultValue={current.w ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          {warehouses.map((x) => (<option key={x.id} value={x.id}>{x.code} — {x.name}</option>))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Vật tư</label>
        <select name="m" defaultValue={current.m ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          {materials.map((x) => (<option key={x.id} value={x.id}>{x.code} — {x.name}</option>))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">Lọc</button>
      </div>
    </form>
  );
}
