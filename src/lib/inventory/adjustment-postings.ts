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
 * Bỏ qua dòng không đổi (change = 0). Dòng chưa có tồn coi tồn cũ = 0.
 */
export function computeAdjustmentPostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: AdjustmentLine[],
): AdjustmentPosting[] {
  const postings: AdjustmentPosting[] = [];
  for (const l of lines) {
    const counted = new Prisma.Decimal(l.countedQty);
    const before = currentQty[l.materialId] ?? new Prisma.Decimal(0);
    const change = counted.minus(before);
    if (change.isZero()) continue;
    postings.push({ materialId: l.materialId, change, balanceAfter: counted });
  }
  return postings;
}
