"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import {
  canCreateIssue,
  canApproveIssue,
  canCompleteIssue,
  canModifyPendingIssue,
} from "@/lib/auth/can";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";
import { validateIssueRequest, validateIssueCompletion } from "./validate-issue";
import { computeIssuePostings } from "./issue-postings";

export interface IssueFormState {
  error?: string;
}

/** Đọc dòng đề nghị từ FormData: material_<i>, qty_<i>. */
function parseRequestLines(formData: FormData): { materialId: string; qty: number }[] {
  const idx = new Set<string>();
  for (const key of formData.keys()) {
    const m = key.match(/^material_(\d+)$/);
    if (m) idx.add(m[1]);
  }
  const ordered = [...idx].sort((a, b) => Number(a) - Number(b));
  const lines: { materialId: string; qty: number }[] = [];
  for (const i of ordered) {
    const materialId = String(formData.get(`material_${i}`) ?? "").trim();
    if (!materialId) continue;
    const qty = Number(String(formData.get(`qty_${i}`) ?? "").trim());
    lines.push({ materialId, qty });
  }
  return lines;
}

async function loadAssignments(userId: string) {
  return db.assignment.findMany({ where: { userId } });
}

/** Xác minh vật tư có thật & đang dùng. */
async function assertMaterialsValid(materialIds: string[]): Promise<boolean> {
  const found = await db.material.findMany({
    where: { id: { in: materialIds }, isActive: true },
    select: { id: true },
  });
  return found.length === materialIds.length;
}

export async function createIssueAction(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const recipient = String(formData.get("recipient") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const lines = parseRequestLines(formData);

  const v = validateIssueRequest({ warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCreateIssue(user, assignments, warehouseId)) redirect("/");

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  const year = new Date().getFullYear();
  const prefix = documentCodePrefix("ISSUE");

  let createdId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const count = await tx.document.count({
          where: { type: "ISSUE", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);
        const doc = await tx.document.create({
          data: {
            code,
            type: "ISSUE",
            warehouseId,
            status: "PENDING",
            createdById: user.id,
            recipient,
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) {
        continue;
      }
      throw e;
    }
  }

  revalidatePath("/issues");
  redirect(`/issues/${createdId}`);
}

export async function updateIssueAction(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const recipient = String(formData.get("recipient") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const lines = parseRequestLines(formData);

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ISSUE") return { error: "Không tìm thấy phiếu" };

  const v = validateIssueRequest({ warehouseId: doc.warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  if (!canModifyPendingIssue(user, doc)) redirect(`/issues/${id}`);

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  await db.$transaction(async (tx) => {
    await tx.documentLine.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        recipient,
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

  revalidatePath("/issues");
  redirect(`/issues/${id}`);
}

export async function cancelIssueAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ISSUE") redirect("/issues");
  const user = await requireUser();
  if (!canModifyPendingIssue(user, doc)) redirect(`/issues/${id}`);
  await db.document.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/issues");
  redirect(`/issues/${id}`);
}

export async function approveIssueAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ISSUE") redirect("/issues");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveIssue(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/issues/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
  });
  revalidatePath("/issues");
  redirect(`/issues/${id}`);
}

export async function rejectIssueAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ISSUE") redirect("/issues");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveIssue(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/issues/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), reason },
  });
  revalidatePath("/issues");
  redirect(`/issues/${id}`);
}

class StockError extends Error {}

export async function completeIssueAction(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const doc = await db.document.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!doc || doc.type !== "ISSUE") return { error: "Không tìm thấy phiếu" };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCompleteIssue(user, assignments, doc.warehouseId)) redirect(`/issues/${id}`);
  if (doc.status !== "APPROVED") return { error: "Phiếu chưa được duyệt hoặc đã xử lý" };

  const completion = doc.lines.map((l) => ({
    lineId: l.id,
    materialId: l.materialId,
    requestedQty: Number(l.requestedQty),
    actualQty: Number(String(formData.get(`actual_${l.id}`) ?? "").trim()),
  }));

  const v = validateIssueCompletion(
    completion.map((c) => ({ requestedQty: c.requestedQty, actualQty: c.actualQty })),
    reason,
  );
  if (!v.ok) return { error: v.error };

  const issueLines = completion
    .filter((c) => c.actualQty > 0)
    .map((c) => ({ materialId: c.materialId, qty: c.actualQty }));
  const materialIds = [...new Set(issueLines.map((l) => l.materialId))];

  try {
    await db.$transaction(async (tx) => {
      const stocks = await tx.stock.findMany({
        where: { warehouseId: doc.warehouseId, materialId: { in: materialIds } },
      });
      const currentQty: Record<string, Prisma.Decimal> = {};
      for (const s of stocks) currentQty[s.materialId] = s.quantity;

      const calc = computeIssuePostings(currentQty, issueLines);
      if (!calc.ok) {
        const mats = await tx.material.findMany({
          where: { id: { in: calc.insufficient.map((x) => x.materialId) } },
          select: { id: true, code: true },
        });
        const codeOf = new Map(mats.map((m) => [m.id, m.code]));
        const detail = calc.insufficient
          .map((x) => `${codeOf.get(x.materialId) ?? x.materialId} (còn ${x.available}, cần ${x.needed})`)
          .join("; ");
        throw new StockError(`Không đủ tồn: ${detail}`);
      }

      for (const p of calc.postings) {
        const dec = p.change.negated();
        const res = await tx.stock.updateMany({
          where: { warehouseId: doc.warehouseId, materialId: p.materialId, quantity: { gte: dec } },
          data: { quantity: { decrement: dec } },
        });
        if (res.count === 0) {
          throw new StockError("Tồn kho vừa thay đổi, không đủ để xuất. Vui lòng thử lại.");
        }
        const after = await tx.stock.findUnique({
          where: { warehouseId_materialId: { warehouseId: doc.warehouseId, materialId: p.materialId } },
        });
        await tx.ledger.create({
          data: {
            warehouseId: doc.warehouseId,
            materialId: p.materialId,
            change: p.change,
            balanceAfter: after!.quantity,
            documentId: doc.id,
          },
        });
      }

      for (const c of completion) {
        await tx.documentLine.update({
          where: { id: c.lineId },
          data: { actualQty: new Prisma.Decimal(c.actualQty) },
        });
      }

      await tx.document.update({
        where: { id },
        data: { status: "COMPLETED", completedById: user.id, completedAt: new Date(), reason },
      });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }

  revalidatePath("/issues");
  revalidatePath("/stock");
  redirect(`/issues/${id}`);
}
