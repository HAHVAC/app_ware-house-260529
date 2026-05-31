import { describe, it, expect } from "vitest";
import { validateReceiptInput } from "./validate-receipt";

const base = {
  warehouseId: "w1",
  documentDate: "2026-05-31",
  note: null as string | null,
  lines: [{ materialId: "m1", qty: 10, price: 1000 }],
};

describe("validateReceiptInput", () => {
  it("hop le", () => {
    expect(validateReceiptInput(base).ok).toBe(true);
  });
  it("thieu kho -> loi", () => {
    expect(validateReceiptInput({ ...base, warehouseId: "" }).ok).toBe(false);
  });
  it("ngay khong hop le -> loi", () => {
    expect(validateReceiptInput({ ...base, documentDate: "khong-phai-ngay" }).ok).toBe(false);
  });
  it("khong co dong nao -> loi", () => {
    expect(validateReceiptInput({ ...base, lines: [] }).ok).toBe(false);
  });
  it("dong thieu materialId -> loi", () => {
    const r = validateReceiptInput({ ...base, lines: [{ materialId: "", qty: 1, price: null }] });
    expect(r.ok).toBe(false);
  });
  it("qty <= 0 -> loi", () => {
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 0, price: null }] }).ok).toBe(false);
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: -2, price: null }] }).ok).toBe(false);
  });
  it("price null hop le; price am loi", () => {
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 1, price: null }] }).ok).toBe(true);
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 1, price: -5 }] }).ok).toBe(false);
  });
});
