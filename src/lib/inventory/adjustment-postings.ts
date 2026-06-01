// src/lib/inventory/adjustment-postings.ts
import { Prisma } from "@prisma/client";

export interface AdjustmentLine {
  materialId: string;
  countedQty: number;
}

export interface AdjustmentPosting {
  materialId: string;
  change: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

/**
 * Tính chênh lệch kiểm kê (thuần): change = đếm − tồn cũ; balanceAfter = đếm.
 * Gộp theo vật tư — số đếm là tuyệt đối nên dòng sau ghi đè dòng trước (last-wins),
 * mỗi vật tư chỉ 1 posting. Bỏ qua dòng không đổi (change = 0). Vật tư chưa có tồn coi tồn cũ = 0.
 */
export function computeAdjustmentPostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: AdjustmentLine[],
): AdjustmentPosting[] {
  const countedByMaterial = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    countedByMaterial.set(l.materialId, new Prisma.Decimal(l.countedQty));
  }

  const postings: AdjustmentPosting[] = [];
  for (const [materialId, counted] of countedByMaterial) {
    const before = currentQty[materialId] ?? new Prisma.Decimal(0);
    const change = counted.minus(before);
    if (change.isZero()) continue;
    postings.push({ materialId, change, balanceAfter: counted });
  }
  return postings;
}
