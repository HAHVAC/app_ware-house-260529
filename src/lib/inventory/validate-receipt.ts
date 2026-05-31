export interface ReceiptLineInput {
  materialId: string;
  qty: number;
  price: number | null;
}

export interface ReceiptInput {
  warehouseId: string;
  documentDate: string;
  note: string | null;
  lines: ReceiptLineInput[];
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateReceiptInput(input: ReceiptInput): ValidateResult {
  if (!input.warehouseId) return { ok: false, error: "Vui lòng chọn kho" };

  const t = Date.parse(input.documentDate);
  if (!input.documentDate || Number.isNaN(t)) {
    return { ok: false, error: "Ngày nhập không hợp lệ" };
  }

  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };

  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      return { ok: false, error: "Số lượng phải lớn hơn 0" };
    }
    if (l.price !== null && (!Number.isFinite(l.price) || l.price < 0)) {
      return { ok: false, error: "Đơn giá không hợp lệ" };
    }
  }

  return { ok: true };
}
