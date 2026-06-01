import { Prisma } from "@prisma/client";

export interface TransferLine { materialId: string; qty: number; }
export interface TransferMove { materialId: string; qty: Prisma.Decimal; }
export interface TransferInsufficient { materialId: string; available: Prisma.Decimal; needed: Prisma.Decimal; }
export type TransferResult =
  | { ok: true; moves: TransferMove[] }
  | { ok: false; insufficient: TransferInsufficient[] };

/** Tính lượng chuyển cho từng vật tư (thuần). Gộp theo vật tư, kiểm tra đủ tồn kho nguồn. */
export function computeTransferPostings(
  sourceQty: Record<string, Prisma.Decimal>,
  lines: TransferLine[],
): TransferResult {
  const totals = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    if (!(l.qty > 0)) continue;
    const prev = totals.get(l.materialId) ?? new Prisma.Decimal(0);
    totals.set(l.materialId, prev.plus(l.qty));
  }
  const insufficient: TransferInsufficient[] = [];
  const moves: TransferMove[] = [];
  for (const [materialId, needed] of totals) {
    const available = sourceQty[materialId] ?? new Prisma.Decimal(0);
    if (available.minus(needed).isNegative()) {
      insufficient.push({ materialId, available, needed });
    } else {
      moves.push({ materialId, qty: needed });
    }
  }
  if (insufficient.length > 0) return { ok: false, insufficient };
  return { ok: true, moves };
}
