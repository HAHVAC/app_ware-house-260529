import { db } from "@/lib/db";
import type { StockValuationInput } from "./stock-valuation";

/**
 * Lấy dòng tồn cho báo cáo.
 * @param viewableIds "ALL" hoặc danh sách id kho được xem.
 * @param target id kho cụ thể, hoặc "all" để gộp tất cả kho trong phạm vi (cộng tồn theo vật tư).
 */
export async function getStockReportRows(
  viewableIds: "ALL" | string[],
  target: string,
): Promise<StockValuationInput[]> {
  const scopeWhere = viewableIds === "ALL" ? {} : { warehouseId: { in: viewableIds } };
  const warehouseWhere =
    target === "all" ? scopeWhere
      : { ...scopeWhere, warehouseId: target };

  const stocks = await db.stock.findMany({
    where: warehouseWhere,
    include: { material: { select: { code: true, name: true, unit: true, latestUnitPrice: true } } },
    orderBy: { material: { code: "asc" } },
  });

  if (target === "all") {
    // Gộp theo vật tư (cộng tồn các kho).
    const map = new Map<string, StockValuationInput>();
    for (const s of stocks) {
      const cur = map.get(s.materialId);
      const qty = Number(s.quantity);
      if (cur) {
        cur.quantity += qty;
      } else {
        map.set(s.materialId, {
          code: s.material.code,
          name: s.material.name,
          unit: s.material.unit,
          quantity: qty,
          unitPrice: s.material.latestUnitPrice != null ? Number(s.material.latestUnitPrice) : null,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  return stocks.map((s) => ({
    code: s.material.code,
    name: s.material.name,
    unit: s.material.unit,
    quantity: Number(s.quantity),
    unitPrice: s.material.latestUnitPrice != null ? Number(s.material.latestUnitPrice) : null,
  }));
}
