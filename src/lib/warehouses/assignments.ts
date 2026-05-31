"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { SITE_ROLES, type SiteRoleInput } from "./roles";

export interface AssignmentFormState {
  error?: string;
}

function readSiteRole(formData: FormData): SiteRoleInput | null {
  const raw = String(formData.get("siteRole") ?? "");
  return (SITE_ROLES as readonly string[]).includes(raw) ? (raw as SiteRoleInput) : null;
}

export async function assignUserAction(
  _prev: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  await requireAdmin();

  const warehouseId = String(formData.get("warehouseId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const siteRole = readSiteRole(formData);

  if (!warehouseId || !userId || !siteRole) {
    return { error: "Vui lòng chọn người dùng và vai trò" };
  }

  try {
    await db.assignment.create({ data: { warehouseId, userId, siteRole } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Người này đã có vai trò này tại công trình" };
    }
    throw e;
  }

  revalidatePath(`/warehouses/${warehouseId}`);
  return {};
}

export async function removeAssignmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (id) await db.assignment.delete({ where: { id } });
  revalidatePath(`/warehouses/${warehouseId}`);
}
