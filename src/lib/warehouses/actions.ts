"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import {
  validateWarehouseInput,
  type WarehouseTypeInput,
  type WarehouseStatusInput,
} from "./validate";

export interface WarehouseFormState {
  error?: string;
}

function readType(formData: FormData): WarehouseTypeInput {
  return String(formData.get("type") ?? "") === "CENTRAL" ? "CENTRAL" : "PROJECT";
}
function readStatus(formData: FormData): WarehouseStatusInput {
  return String(formData.get("status") ?? "") === "CLOSED" ? "CLOSED" : "ACTIVE";
}

export async function createWarehouseAction(
  _prev: WarehouseFormState,
  formData: FormData,
): Promise<WarehouseFormState> {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const type = readType(formData);
  const status = readStatus(formData);

  const v = validateWarehouseInput({ code, name, type, status });
  if (!v.ok) return { error: v.error };

  try {
    await db.warehouse.create({
      data: { code, name, address: address || null, type, status },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Mã công trình/kho đã tồn tại" };
    }
    throw e;
  }

  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function updateWarehouseAction(
  _prev: WarehouseFormState,
  formData: FormData,
): Promise<WarehouseFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const type = readType(formData);
  const status = readStatus(formData);

  const target = await db.warehouse.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy công trình" };

  const v = validateWarehouseInput({ code: target.code, name, type, status });
  if (!v.ok) return { error: v.error };

  await db.warehouse.update({
    where: { id },
    data: { name, address: address || null, type, status },
  });

  revalidatePath("/warehouses");
  redirect("/warehouses");
}
