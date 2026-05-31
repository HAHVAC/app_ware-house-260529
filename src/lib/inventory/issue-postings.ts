import { Prisma } from "@prisma/client";

export interface IssueLine {
  materialId: string;
  qty: number;
}

export interface IssuePosting {
  materialId: string;
  change: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

export interface Insufficient {
  materialId: string;
  available: Prisma.Decimal;
  needed: Prisma.Decimal;
}

export type IssueResult =
  | { ok: true; postings: IssuePosting[] }
  | { ok: false; insufficient: Insufficient[] };

/**
 * Tính biến động tồn cho phiếu xuất (thuần). Gộp theo vật tư, trừ tồn, kiểm tra đủ.
 */
export function computeIssuePostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: IssueLine[],
): IssueResult {
  const totals = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    if (!(l.qty > 0)) continue;
    const prev = totals.get(l.materialId) ?? new Prisma.Decimal(0);
    totals.set(l.materialId, prev.plus(l.qty));
  }

  const insufficient: Insufficient[] = [];
  const postings: IssuePosting[] = [];
  for (const [materialId, needed] of totals) {
    const available = currentQty[materialId] ?? new Prisma.Decimal(0);
    const after = available.minus(needed);
    if (after.isNegative()) {
      insufficient.push({ materialId, available, needed });
    } else {
      postings.push({ materialId, change: needed.negated(), balanceAfter: after });
    }
  }

  if (insufficient.length > 0) return { ok: false, insufficient };
  return { ok: true, postings };
}
