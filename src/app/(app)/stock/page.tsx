import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const selectedId = w && warehouses.some((x) => x.id === w) ? w : warehouses[0]?.id;

  const stocks = selectedId
    ? await db.stock.findMany({
        where: { warehouseId: selectedId },
        include: { material: { select: { code: true, name: true, unit: true } } },
        orderBy: { material: { code: "asc" } },
      })
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Tồn kho</h1>

      <div className="flex flex-wrap gap-2">
        {warehouses.map((x) => (
          <Link
            key={x.id}
            href={`/stock?w=${x.id}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${x.id === selectedId ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
          >
            {x.code} — {x.name}
          </Link>
        ))}
      </div>

      {!selectedId ? (
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
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{s.material.code}</td>
                  <td className="px-3 py-2">{s.material.name}</td>
                  <td className="px-3 py-2 text-right">{Number(s.quantity).toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">{s.material.unit}</td>
                </tr>
              ))}
              {stocks.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Kho này chưa có tồn</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
