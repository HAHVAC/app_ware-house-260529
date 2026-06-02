import { db } from "@/lib/db";
import type { HistoryFilters } from "./history-filters";

export interface HistoryRow {
  id: string;
  date: Date;
  warehouseCode: string;
  warehouseName: string;
  materialCode: string;
  materialName: string;
  unit: string;
  type: string;
  change: number;
  balanceAfter: number;
  documentCode: string;
  createdByName: string;
}

export async function getHistoryRows(
  filters: HistoryFilters,
  viewableIds: "ALL" | string[],
): Promise<HistoryRow[]> {
  const where: Record<string, unknown> = {};

  // Phạm vi xem + lọc kho.
  if (viewableIds !== "ALL") where.warehouseId = { in: viewableIds };
  if (filters.warehouseId) {
    // Kho được chọn (đã được caller kiểm nằm trong phạm vi xem trước khi gọi).
    where.warehouseId = filters.warehouseId;
  }
  if (filters.materialId) where.materialId = filters.materialId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.type) where.document = { type: filters.type };

  const rows = await db.ledger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      warehouse: { select: { code: true, name: true } },
      material: { select: { code: true, name: true, unit: true } },
      document: { select: { code: true, type: true, createdBy: { select: { fullName: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    date: r.createdAt,
    warehouseCode: r.warehouse.code,
    warehouseName: r.warehouse.name,
    materialCode: r.material.code,
    materialName: r.material.name,
    unit: r.material.unit,
    type: r.document.type,
    change: Number(r.change),
    balanceAfter: Number(r.balanceAfter),
    documentCode: r.document.code,
    createdByName: r.document.createdBy.fullName,
  }));
}
