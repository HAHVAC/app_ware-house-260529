export interface MaterialInput {
  code: string;
  name: string;
  unit: string;
  price: number | null;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateMaterialInput(input: MaterialInput): ValidateResult {
  if (!input.code || !input.code.trim()) return { ok: false, error: "Vui lòng nhập mã vật tư" };
  if (!input.name || !input.name.trim()) return { ok: false, error: "Vui lòng nhập tên vật tư" };
  if (!input.unit || !input.unit.trim()) return { ok: false, error: "Vui lòng nhập đơn vị tính" };
  if (input.price !== null) {
    if (!Number.isFinite(input.price) || input.price < 0) {
      return { ok: false, error: "Đơn giá không hợp lệ" };
    }
  }
  return { ok: true };
}
