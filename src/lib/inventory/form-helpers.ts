import { db } from "@/lib/db";

/** Đọc các dòng vật tư từ FormData: material_<i> + <valueKey>_<i>. Trả {materialId, value}. */
export function parseLines(
  formData: FormData,
  valueKey: string,
): { materialId: string; value: number }[] {
  const idx = new Set<string>();
  for (const key of formData.keys()) {
    const m = key.match(/^material_(\d+)$/);
    if (m) idx.add(m[1]);
  }
  const ordered = [...idx].sort((a, b) => Number(a) - Number(b));
  const lines: { materialId: string; value: number }[] = [];
  for (const i of ordered) {
    const materialId = String(formData.get(`material_${i}`) ?? "").trim();
    if (!materialId) continue;
    const value = Number(String(formData.get(`${valueKey}_${i}`) ?? "").trim());
    lines.push({ materialId, value });
  }
  return lines;
}

export async function loadAssignments(userId: string) {
  return db.assignment.findMany({ where: { userId } });
}

/** Xác minh vật tư có thật & đang dùng. */
export async function assertMaterialsValid(materialIds: string[]): Promise<boolean> {
  if (materialIds.length === 0) return true;
  const found = await db.material.findMany({
    where: { id: { in: materialIds }, isActive: true },
    select: { id: true },
  });
  return found.length === materialIds.length;
}
