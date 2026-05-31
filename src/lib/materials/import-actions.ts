"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { parseMaterialRows } from "./import-parse";

export interface ImportState {
  error?: string;
  summary?: { created: number; updated: number; errors: { line: number; message: string }[] };
}

export async function importMaterialsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vui lòng chọn file Excel (.xlsx)" };
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(Buffer.from(arrayBuffer) as any);
  } catch {
    return { error: "Không đọc được file. Hãy dùng định dạng .xlsx" };
  }

  const ws = wb.worksheets[0];
  if (!ws) return { error: "File không có sheet nào" };

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = cell.text.trim(); // .text làm phẳng rich-text/công thức
  });

  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cell.value;
      // Ô rich-text/công thức/hyperlink trả về object → dùng .text (đã làm phẳng).
      // Số/chuỗi/ngày giữ nguyên (để parse đơn giá số đúng).
      obj[key] = v !== null && typeof v === "object" && !(v instanceof Date) ? cell.text : v;
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });

  const { items, errors } = parseMaterialRows(rows);

  let created = 0;
  let updated = 0;
  for (const it of items) {
    const existing = await db.material.findUnique({ where: { code: it.code } });
    await db.material.upsert({
      where: { code: it.code },
      create: {
        code: it.code, name: it.name, unit: it.unit,
        categoryName: it.categoryName, modelCode: it.modelCode,
        brandOrigin: it.brandOrigin, specification: it.specification,
        latestUnitPrice: it.latestUnitPrice,
      },
      update: {
        name: it.name, unit: it.unit,
        categoryName: it.categoryName, modelCode: it.modelCode,
        brandOrigin: it.brandOrigin, specification: it.specification,
        latestUnitPrice: it.latestUnitPrice,
      },
    });
    if (existing) updated++;
    else created++;
  }

  revalidatePath("/materials");
  return { summary: { created, updated, errors } };
}
