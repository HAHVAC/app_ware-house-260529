import type { DocumentType } from "@prisma/client";

export interface HistoryFilters {
  from: Date | null;
  to: Date | null;
  warehouseId: string | null;
  materialId: string | null;
  type: DocumentType | null;
}

const TYPES: DocumentType[] = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"];

/** Parse ngày YYYY-MM-DD theo giờ ĐỊA PHƯƠNG (tránh lệch múi giờ). endOfDay=true → 23:59:59.999. */
function parseLocalDate(s: string | undefined, endOfDay: boolean): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const date = endOfDay ? new Date(y, mo, d, 23, 59, 59, 999) : new Date(y, mo, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export function parseHistoryFilters(params: {
  from?: string; to?: string; w?: string; m?: string; type?: string;
}): HistoryFilters {
  const type = params.type && (TYPES as string[]).includes(params.type)
    ? (params.type as DocumentType) : null;
  return {
    from: parseLocalDate(params.from, false),
    to: parseLocalDate(params.to, true),
    warehouseId: params.w?.trim() || null,
    materialId: params.m?.trim() || null,
    type,
  };
}
