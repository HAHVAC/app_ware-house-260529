// src/lib/inventory/adjustment-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canCreateAdjustment, canApproveAdjustment, canModifyPendingDoc } from "@/lib/auth/can";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";
import { validateAdjustmentRequest } from "./validate-adjustment";
import { computeAdjustmentPostings } from "./adjustment-postings";
import { parseLines, loadAssignments, assertMaterialsValid } from "./form-helpers";

export interface AdjustmentFormState {
  error?: string;
}

export async function createAdjustmentAction(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "counted");
  const lines = raw.map((l) => ({ materialId: l.materialId, countedQty: l.value }));

  const v = validateAdjustmentRequest({ warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCreateAdjustment(user, assignments, warehouseId)) redirect("/");

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  const year = new Date().getFullYear();
  const prefix = documentCodePrefix("ADJUSTMENT");

  let createdId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const count = await tx.document.count({
          where: { type: "ADJUSTMENT", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);
        const doc = await tx.document.create({
          data: {
            code,
            type: "ADJUSTMENT",
            warehouseId,
            status: "PENDING",
            createdById: user.id,
            note,
            documentDate: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(0),
                countedQty: new Prisma.Decimal(l.countedQty),
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

  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${createdId}`);
}

export async function updateAdjustmentAction(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "counted");
  const lines = raw.map((l) => ({ materialId: l.materialId, countedQty: l.value }));

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") return { error: "Không tìm thấy phiếu" };

  const v = validateAdjustmentRequest({ warehouseId: doc.warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  await db.$transaction(async (tx) => {
    await tx.documentLine.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        note,
        lines: {
          create: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: new Prisma.Decimal(0),
            countedQty: new Prisma.Decimal(l.countedQty),
          })),
        },
      },
    });
  });

  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

export async function cancelAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);
  await db.document.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

export async function rejectAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveAdjustment(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/stocktakes/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), reason },
  });
  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

/** Duyệt = áp dụng: đặt tồn = số đếm (upsert), ghi Ledger chênh lệch → COMPLETED. */
export async function approveAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id }, include: { lines: true } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const warehouseId = doc.warehouseId;

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canApproveAdjustment(user, assignments, warehouseId, doc.createdById)) redirect(`/stocktakes/${id}`);
  if (doc.status !== "PENDING") redirect(`/stocktakes/${id}`);

  const lines = doc.lines
    .filter((l) => l.countedQty != null)
    .map((l) => ({ materialId: l.materialId, countedQty: Number(l.countedQty) }));
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  await db.$transaction(async (tx) => {
    const stocks = await tx.stock.findMany({ where: { warehouseId, materialId: { in: materialIds } } });
    const currentQty: Record<string, Prisma.Decimal> = {};
    for (const s of stocks) currentQty[s.materialId] = s.quantity;

    const postings = computeAdjustmentPostings(currentQty, lines);
    for (const p of postings) {
      await tx.stock.upsert({
        where: { warehouseId_materialId: { warehouseId, materialId: p.materialId } },
        create: { warehouseId, materialId: p.materialId, quantity: p.balanceAfter },
        update: { quantity: p.balanceAfter },
      });
      await tx.ledger.create({
        data: { warehouseId, materialId: p.materialId, change: p.change, balanceAfter: p.balanceAfter, documentId: doc.id },
      });
    }

    await tx.document.update({
      where: { id },
      data: { status: "COMPLETED", approvedById: user.id, approvedAt: new Date(), completedById: user.id, completedAt: new Date() },
    });
  });

  revalidatePath("/stocktakes");
  revalidatePath("/stock");
  redirect(`/stocktakes/${id}`);
}
