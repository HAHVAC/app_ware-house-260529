export type ValidateResult = { ok: true } | { ok: false; error: string };
export interface TransferRequestLineInput { materialId: string; qty: number; }
export function validateTransferRequest(input: {
  sourceWarehouseId: string; targetWarehouseId: string; lines: TransferRequestLineInput[];
}): ValidateResult {
  if (!input.sourceWarehouseId) return { ok: false, error: "Vui lòng chọn kho nguồn" };
  if (!input.targetWarehouseId) return { ok: false, error: "Vui lòng chọn kho đích" };
  if (input.sourceWarehouseId === input.targetWarehouseId) return { ok: false, error: "Kho nguồn và kho đích phải khác nhau" };
  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) return { ok: false, error: "Số lượng phải lớn hơn 0" };
  }
  return { ok: true };
}
