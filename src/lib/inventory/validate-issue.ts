export type ValidateResult = { ok: true } | { ok: false; error: string };

export interface IssueRequestLineInput {
  materialId: string;
  qty: number;
}

export function validateIssueRequest(input: {
  warehouseId: string;
  lines: IssueRequestLineInput[];
}): ValidateResult {
  if (!input.warehouseId) return { ok: false, error: "Vui lòng chọn kho" };
  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      return { ok: false, error: "Số lượng phải lớn hơn 0" };
    }
  }
  return { ok: true };
}

export interface CompletionLineInput {
  requestedQty: number;
  actualQty: number;
}

export function validateIssueCompletion(
  lines: CompletionLineInput[],
  reason: string | null,
): ValidateResult {
  if (lines.length === 0) return { ok: false, error: "Phiếu không có dòng nào" };
  let total = 0;
  let differs = false;
  for (const l of lines) {
    if (!Number.isFinite(l.actualQty) || l.actualQty < 0) {
      return { ok: false, error: "Số thực xuất không hợp lệ" };
    }
    total += l.actualQty;
    if (l.actualQty !== l.requestedQty) differs = true;
  }
  if (total <= 0) return { ok: false, error: "Tổng số thực xuất phải lớn hơn 0" };
  if (differs && (!reason || !reason.trim())) {
    return { ok: false, error: "Số thực xuất khác số đề nghị — vui lòng ghi lý do chênh lệch" };
  }
  return { ok: true };
}
