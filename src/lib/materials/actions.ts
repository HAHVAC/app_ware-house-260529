"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { validateMaterialInput } from "./validate";

export interface MaterialFormState {
  error?: string;
}

function readPrice(formData: FormData): number | null {
  const raw = String(formData.get("latestUnitPrice") ?? "").trim();
  return raw === "" ? null : Number(raw);
}
function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createMaterialAction(
  _prev: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireAdmin();

  const code = s(formData, "code");
  const name = s(formData, "name");
  const unit = s(formData, "unit");
  const price = readPrice(formData);

  const v = validateMaterialInput({ code, name, unit, price });
  if (!v.ok) return { error: v.error };

  try {
    await db.material.create({
      data: {
        code,
        name,
        unit,
        categoryName: s(formData, "categoryName") || null,
        modelCode: s(formData, "modelCode") || null,
        brandOrigin: s(formData, "brandOrigin") || null,
        specification: s(formData, "specification") || null,
        latestUnitPrice: price,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Mã vật tư đã tồn tại" };
    }
    throw e;
  }

  revalidatePath("/materials");
  redirect("/materials");
}

export async function updateMaterialAction(
  _prev: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireAdmin();

  const id = s(formData, "id");
  const name = s(formData, "name");
  const unit = s(formData, "unit");
  const price = readPrice(formData);
  const isActive = formData.get("isActive") === "on";

  const target = await db.material.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy vật tư" };

  const v = validateMaterialInput({ code: target.code, name, unit, price });
  if (!v.ok) return { error: v.error };

  await db.material.update({
    where: { id },
    data: {
      name,
      unit,
      categoryName: s(formData, "categoryName") || null,
      modelCode: s(formData, "modelCode") || null,
      brandOrigin: s(formData, "brandOrigin") || null,
      specification: s(formData, "specification") || null,
      latestUnitPrice: price,
      isActive,
    },
  });

  revalidatePath("/materials");
  redirect("/materials");
}
