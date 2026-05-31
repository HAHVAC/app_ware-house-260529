export type WarehouseTypeInput = "PROJECT" | "CENTRAL";
export type WarehouseStatusInput = "ACTIVE" | "CLOSED";

export interface WarehouseInput {
  code: string;
  name: string;
  type: WarehouseTypeInput;
  status: WarehouseStatusInput;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

const TYPES = ["PROJECT", "CENTRAL"];
const STATUSES = ["ACTIVE", "CLOSED"];

export function validateWarehouseInput(input: WarehouseInput): ValidateResult {
  if (!input.code || !input.code.trim()) {
    return { ok: false, error: "Vui lòng nhập mã công trình/kho" };
  }
  if (!input.name || !input.name.trim()) {
    return { ok: false, error: "Vui lòng nhập tên công trình" };
  }
  if (!TYPES.includes(input.type)) {
    return { ok: false, error: "Loại kho không hợp lệ" };
  }
  if (!STATUSES.includes(input.status)) {
    return { ok: false, error: "Trạng thái không hợp lệ" };
  }
  return { ok: true };
}
