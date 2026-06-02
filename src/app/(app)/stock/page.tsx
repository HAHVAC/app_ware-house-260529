import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { getStockReportRows } from "@/lib/reports/stock-report";
import { computeStockValuation } from "@/lib/reports/stock-valuation";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // target: id kho cụ thể, "all", hoặc mặc định kho đầu tiên.
  const valid = w === "all" || warehouses.some((x) => x.id === w);
  const target = valid ? (w as string) : warehouses[0]?.id;

  const rows = target ? await getStockReportRows(scope, target) : [];
  const report = computeStockValuation(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tồn kho{target === "all" ? " — tất cả kho" : ""}</h1>
        {target && (
          <a href={`/api/reports/stock/export?w=${target}`} className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm">⬇ Xuất Excel</a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/stock?w=all`} className={`px-3 py-1.5 rounded-lg text-sm border ${target === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}>Tất cả kho</Link>
        {warehouses.map((x) => (
          <Link key={x.id} href={`/stock?w=${x.id}`} className={`px-3 py-1.5 rounded-lg text-sm border ${x.id === target ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}>
            {x.code} — {x.name}
          </Link>
        ))}
      </div>

      {!target ? (
        <p className="text-sm text-gray-500">Chưa có kho nào để xem.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Mã VT</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2 text-right">Tồn</th>
                <th className="px-3 py-2">ĐVT</th>
                <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
                <th className="px-3 py-2 text-right">Giá trị (VND)</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono">{l.code}</td>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-right">{l.quantity.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">{l.unit}</td>
                  <td className="px-3 py-2 text-right">{l.unitPrice != null ? l.unitPrice.toLocaleString("vi-VN") : "—"}</td>
                  <td className="px-3 py-2 text-right">{l.value != null ? l.value.toLocaleString("vi-VN") : "—"}</td>
                </tr>
              ))}
              {report.lines.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Chưa có tồn</td></tr>
              )}
            </tbody>
            {report.lines.length > 0 && (
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td className="px-3 py-2" colSpan={5}>TỔNG GIÁ TRỊ TỒN</td>
                  <td className="px-3 py-2 text-right">{report.totalValue.toLocaleString("vi-VN")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {report.missingPriceCount > 0 && (
        <p className="text-xs text-gray-500">{report.missingPriceCount} vật tư chưa có đơn giá tham khảo nên không tính vào tổng giá trị.</p>
      )}
    </div>
  );
}
