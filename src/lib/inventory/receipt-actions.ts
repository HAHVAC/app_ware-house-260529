"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireReceiptCreator } from "@/lib/auth/site-guards";
import { validateReceiptInput, type ReceiptLineInput } from "./validate-receipt";
import { computeReceiptPostings } from "./postings";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";

export interface ReceiptFormState {
  error?: string;
}

/** Đọc các dòng từ FormData: material_<i>, qty_<i>, price_<i>. */
function parseLines(formData: FormData): ReceiptLineInput[] {
  const indexes = new Set<string>();
  for (const key of formData.keys()) {
    const m = key.match(/^material_(\d+)$/);
    if (m) indexes.add(m[1]);
  }
  const lines: ReceiptLineInput[] = [];
  for (const i of indexes) {
    const materialId = String(formData.get(`material_${i}`) ?? "").trim();
    if (!materialId) continue;
    const qty = Number(String(formData.get(`qty_${i}`) ?? "").trim());
    const priceRaw = String(formData.get(`price_${i}`) ?? "").trim();
    const price = priceRaw === "" ? null : Number(priceRaw);
    lines.push({ materialId, qty, price });
  }
  return lines;
}

export async function createReceiptAction(
  _prev: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const documentDate = String(formData.get("documentDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const lines = parseLines(formData);

  const v = validateReceiptInput({ warehouseId, documentDate, note, lines });
  if (!v.ok) return { error: v.error };

  // Phân quyền (redirect nếu không được phép — nằm ngoài try/catch bên dưới)
  const user = await requireReceiptCreator(warehouseId);

  const year = new Date(documentDate).getFullYear();
  const prefix = documentCodePrefix("RECEIPT");
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  let createdId = "";
  // Retry khi trùng số phiếu (P2002) do tạo đồng thời
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const stocks = await tx.stock.findMany({
          where: { warehouseId, materialId: { in: materialIds } },
        });
        const currentQty: Record<string, Prisma.Decimal> = {};
        for (const s of stocks) currentQty[s.materialId] = s.quantity;

        const { postings, newStock } = computeReceiptPostings(currentQty, lines);

        const count = await tx.document.count({
          where: { type: "RECEIPT", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);

        const doc = await tx.document.create({
          data: {
            code,
            type: "RECEIPT",
            warehouseId,
            status: "COMPLETED",
            createdById: user.id,
            completedById: user.id,
            note,
            documentDate: new Date(documentDate),
            completedAt: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(l.qty),
                unitPrice: l.price === null ? null : new Prisma.Decimal(l.price),
              })),
            },
          },
        });

        // Cập nhật tồn
        for (const [materialId, qty] of Object.entries(newStock)) {
          await tx.stock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId } },
            create: { warehouseId, materialId, quantity: qty },
            update: { quantity: qty },
          });
        }

        // Ghi sổ kho
        await tx.ledger.createMany({
          data: postings.map((p) => ({
            warehouseId,
            materialId: p.materialId,
            change: p.change,
            balanceAfter: p.balanceAfter,
            documentId: doc.id,
          })),
        });

        // Cập nhật đơn giá tham khảo cho dòng có giá
        for (const l of lines) {
          if (l.price !== null) {
            await tx.material.update({
              where: { id: l.materialId },
              data: { latestUnitPrice: new Prisma.Decimal(l.price) },
            });
          }
        }

        return doc.id;
      });
      break; // thành công
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        attempt < 4
      ) {
        continue; // trùng số phiếu → thử lại
      }
      throw e;
    }
  }

  revalidatePath("/receipts");
  revalidatePath("/stock");
  redirect(`/receipts/${createdId}`);
}
