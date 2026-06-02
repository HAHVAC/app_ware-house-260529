import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { parseHistoryFilters } from "@/lib/reports/history-filters";
import { getHistoryRows } from "@/lib/reports/history-report";
import { HistoryFilters } from "./HistoryFilters";

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  RECEIPT: { label: "Nhập", cls: "text-green-600" },
  ISSUE: { label: "Xuất", cls: "text-blue-600" },
  TRANSFER: { label: "Điều chuyển", cls: "text-purple-600" },
  ADJUSTMENT: { label: "Kiểm kê", cls: "text-amber-600" },
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; w?: string; m?: string; type?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" }, select: { id: true, code: true, name: true },
  });
  const materials = await db.material.findMany({
    orderBy: { code: "asc" }, select: { id: true, code: true, name: true },
  });

  const filters = parseHistoryFilters(sp);
  // Chặn lọc kho ngoài phạm vi xem.
  if (filters.warehouseId && scope !== "ALL" && !scope.includes(filters.warehouseId)) {
    filters.warehouseId = null;
  }
  const rows = await getHistoryRows(filters, scope);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lịch sử giao dịch</h1>
        <a href={`/api/reports/history/export${qs ? `?${qs}` : ""}`} className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm">⬇ Xuất Excel</a>
      </div>

      <HistoryFilters warehouses={warehouses} materials={materials} current={sp} />

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2">Vật tư</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2 text-right">Biến động</th>
              <th className="px-3 py-2 text-right">Tồn sau</th>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Người lập</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.date.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{r.warehouseCode}</td>
                <td className="px-3 py-2"><span className="font-mono">{r.materialCode}</span> {r.materialName}</td>
                <td className="px-3 py-2"><span className={TYPE_LABEL[r.type]?.cls}>{TYPE_LABEL[r.type]?.label ?? r.type}</span></td>
                <td className={`px-3 py-2 text-right ${r.change < 0 ? "text-red-600" : "text-green-600"}`}>{r.change > 0 ? "+" : ""}{r.change.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">{r.balanceAfter.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 font-mono">{r.documentCode}</td>
                <td className="px-3 py-2">{r.createdByName}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Không có giao dịch khớp bộ lọc</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Hiển thị tối đa 1000 dòng gần nhất. Dùng bộ lọc để thu hẹp.</p>
    </div>
  );
}
