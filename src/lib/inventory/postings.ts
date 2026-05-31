import { Prisma } from "@prisma/client";

export interface ReceiptPostingLine {
  materialId: string;
  qty: number;
}

export interface Posting {
  materialId: string;
  change: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

export interface ReceiptPostingResult {
  postings: Posting[];
  newStock: Record<string, Prisma.Decimal>;
}

/**
 * Tính biến động tồn cho phiếu nhập (thuần, không chạm DB).
 * @param currentQty tồn hiện tại theo materialId (thiếu = 0)
 * @param lines các dòng nhập (đã hợp lệ: qty > 0)
 */
export function computeReceiptPostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: ReceiptPostingLine[],
): ReceiptPostingResult {
  const newStock: Record<string, Prisma.Decimal> = {};
  for (const [k, v] of Object.entries(currentQty)) newStock[k] = new Prisma.Decimal(v);

  const postings: Posting[] = [];
  for (const line of lines) {
    const before = newStock[line.materialId] ?? new Prisma.Decimal(0);
    const change = new Prisma.Decimal(line.qty);
    const after = before.plus(change);
    newStock[line.materialId] = after;
    postings.push({ materialId: line.materialId, change, balanceAfter: after });
  }

  return { postings, newStock };
}
