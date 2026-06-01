"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canCreateTransfer, canApproveTransfer, canModifyPendingDoc } from "@/lib/auth/can";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";
import { validateTransferRequest } from "./validate-transfer";
import { computeTransferPostings } from "./transfer-postings";
import { parseLines, loadAssignments, assertMaterialsValid } from "./form-helpers";

export interface TransferFormState {
  error?: string;
}

class StockError extends Error {}

export async function createTransferAction(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const sourceWarehouseId = String(formData.get("warehouseId") ?? "").trim();
  const targetWarehouseId = String(formData.get("targetWarehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "qty");
  const lines = raw.map((l) => ({ materialId: l.materialId, qty: l.value }));

  const v = validateTransferRequest({ sourceWarehouseId, targetWarehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCreateTransfer(user, assignments, sourceWarehouseId)) redirect("/");

  // Kho nguồn & kho đích phải tồn tại & đang ACTIVE.
  const source = await db.warehouse.findFirst({ where: { id: sourceWarehouseId, status: "ACTIVE" }, select: { id: true } });
  if (!source) return { error: "Kho nguồn không hợp lệ hoặc đã đóng" };
  const target = await db.warehouse.findFirst({ where: { id: targetWarehouseId, status: "ACTIVE" }, select: { id: true } });
  if (!target) return { error: "Kho đích không hợp lệ hoặc đã đóng" };

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  const year = new Date().getFullYear();
  const prefix = documentCodePrefix("TRANSFER");

  let createdId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const count = await tx.document.count({
          where: { type: "TRANSFER", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);
        const doc = await tx.document.create({
          data: {
            code,
            type: "TRANSFER",
            warehouseId: sourceWarehouseId,
            targetWarehouseId,
            status: "PENDING",
            createdById: user.id,
            note,
            documentDate: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(l.qty),
              })),
            },
          },
        });
        return doc.id;
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }

  revalidatePath("/transfers");
  redirect(`/transfers/${createdId}`);
}

export async function updateTransferAction(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const targetWarehouseId = String(formData.get("targetWarehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "qty");
  const lines = raw.map((l) => ({ materialId: l.materialId, qty: l.value }));

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") return { error: "Không tìm thấy phiếu" };

  const v = validateTransferRequest({ sourceWarehouseId: doc.warehouseId, targetWarehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);

  const target = await db.warehouse.findFirst({ where: { id: targetWarehouseId, status: "ACTIVE" }, select: { id: true } });
  if (!target) return { error: "Kho đích không hợp lệ" };

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  await db.$transaction(async (tx) => {
    await tx.documentLine.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        targetWarehouseId,
        note,
        lines: {
          create: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: new Prisma.Decimal(l.qty),
          })),
        },
      },
    });
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

export async function cancelTransferAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") redirect("/transfers");
  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);
  await db.document.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

export async function rejectTransferAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") redirect("/transfers");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveTransfer(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/transfers/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), reason },
  });
  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

/** Duyệt = áp dụng: trừ kho nguồn (atomic), cộng kho đích, ghi Ledger 2 dòng/vật tư → COMPLETED. */
export async function approveTransferAction(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id }, include: { lines: true } });
  if (!doc || doc.type !== "TRANSFER" || !doc.targetWarehouseId) redirect("/transfers");
  const source = doc.warehouseId;
  const targetId = doc.targetWarehouseId;

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canApproveTransfer(user, assignments, source, doc.createdById)) redirect(`/transfers/${id}`);
  if (doc.status !== "PENDING") return { error: "Phiếu đã được xử lý" };

  const lines = doc.lines.map((l) => ({ materialId: l.materialId, qty: Number(l.requestedQty) }));
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  try {
    await db.$transaction(async (tx) => {
      const stocks = await tx.stock.findMany({ where: { warehouseId: source, materialId: { in: materialIds } } });
      const sourceQty: Record<string, Prisma.Decimal> = {};
      for (const s of stocks) sourceQty[s.materialId] = s.quantity;

      const calc = computeTransferPostings(sourceQty, lines);
      if (!calc.ok) {
        const mats = await tx.material.findMany({
          where: { id: { in: calc.insufficient.map((x) => x.materialId) } },
          select: { id: true, code: true },
        });
        const codeOf = new Map(mats.map((m) => [m.id, m.code]));
        const detail = calc.insufficient
          .map((x) => `${codeOf.get(x.materialId) ?? x.materialId} (còn ${x.available}, cần ${x.needed})`)
          .join("; ");
        throw new StockError(`Không đủ tồn kho nguồn: ${detail}`);
      }

      for (const mv of calc.moves) {
        // Trừ kho nguồn (atomic, chặn âm).
        const res = await tx.stock.updateMany({
          where: { warehouseId: source, materialId: mv.materialId, quantity: { gte: mv.qty } },
          data: { quantity: { decrement: mv.qty } },
        });
        if (res.count === 0) throw new StockError("Tồn kho nguồn vừa thay đổi, không đủ để chuyển. Vui lòng thử lại.");
        const srcAfter = await tx.stock.findUnique({
          where: { warehouseId_materialId: { warehouseId: source, materialId: mv.materialId } },
        });
        await tx.ledger.create({
          data: { warehouseId: source, materialId: mv.materialId, change: mv.qty.negated(), balanceAfter: srcAfter!.quantity, documentId: doc.id },
        });

        // Cộng kho đích (tạo dòng tồn nếu chưa có).
        await tx.stock.upsert({
          where: { warehouseId_materialId: { warehouseId: targetId, materialId: mv.materialId } },
          create: { warehouseId: targetId, materialId: mv.materialId, quantity: mv.qty },
          update: { quantity: { increment: mv.qty } },
        });
        const dstAfter = await tx.stock.findUnique({
          where: { warehouseId_materialId: { warehouseId: targetId, materialId: mv.materialId } },
        });
        await tx.ledger.create({
          data: { warehouseId: targetId, materialId: mv.materialId, change: mv.qty, balanceAfter: dstAfter!.quantity, documentId: doc.id },
        });
      }

      await tx.document.update({
        where: { id },
        data: { status: "COMPLETED", approvedById: user.id, approvedAt: new Date(), completedById: user.id, completedAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }

  revalidatePath("/transfers");
  revalidatePath("/stock");
  redirect(`/transfers/${id}`);
}
