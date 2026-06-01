// src/lib/inventory/validate-adjustment.test.ts
import { describe, it, expect } from "vitest";
import { validateAdjustmentRequest } from "./validate-adjustment";

describe("validateAdjustmentRequest", () => {
  it("thieu kho -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "", lines: [{ materialId: "m1", countedQty: 1 }] });
    expect(r.ok).toBe(false);
  });

  it("khong co dong -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [] });
    expect(r.ok).toBe(false);
  });

  it("so dem am -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: -1 }] });
    expect(r.ok).toBe(false);
  });

  it("so dem = 0 hop le", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: 0 }] });
    expect(r.ok).toBe(true);
  });

  it("hop le", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: 5 }] });
    expect(r.ok).toBe(true);
  });
});
