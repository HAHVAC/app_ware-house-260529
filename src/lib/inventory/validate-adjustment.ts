// src/lib/inventory/validate-adjustment.ts
export type ValidateResult = { ok: true } | { ok: false; error: string };

export interface AdjustmentRequestLineInput {
  materialId: string;
  countedQty: number;
}

export function validateAdjustmentRequest(input: {
  warehouseId: string;
  lines: AdjustmentRequestLineInput[];
}): ValidateResult {
  if (!input.warehouseId) return { ok: false, error: "Vui lòng chọn kho" };
  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };
  for (const l of lines) {
    if (!Number.isFinite(l.countedQty) || l.countedQty < 0) {
      return { ok: false, error: "Số đếm thực tế không hợp lệ (phải ≥ 0)" };
    }
  }
  return { ok: true };
}
