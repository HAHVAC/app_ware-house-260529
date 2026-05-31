import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MaterialEditForm } from "./form";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const m = await db.material.findUnique({ where: { id } });
  if (!m) notFound();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Sửa vật tư</h1>
      <MaterialEditForm
        material={{
          id: m.id,
          code: m.code,
          name: m.name,
          unit: m.unit,
          categoryName: m.categoryName ?? "",
          modelCode: m.modelCode ?? "",
          brandOrigin: m.brandOrigin ?? "",
          specification: m.specification ?? "",
          price: m.latestUnitPrice != null ? String(m.latestUnitPrice) : "",
          isActive: m.isActive,
        }}
      />
    </div>
  );
}
