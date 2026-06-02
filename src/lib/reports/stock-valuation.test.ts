import { describe, it, expect } from "vitest";
import { computeStockValuation } from "./stock-valuation";

const row = (code: string, quantity: number, unitPrice: number | null) => ({
  code, name: code, unit: "cái", quantity, unitPrice,
});

describe("computeStockValuation", () => {
  it("co don gia -> value = ton * gia, cong vao tong", () => {
    const r = computeStockValuation([row("A", 10, 1000), row("B", 2, 500)]);
    expect(r.lines[0].value).toBe(10000);
    expect(r.lines[1].value).toBe(1000);
    expect(r.totalValue).toBe(11000);
    expect(r.missingPriceCount).toBe(0);
  });

  it("thieu don gia -> value null, khong cong tong, dem missing", () => {
    const r = computeStockValuation([row("A", 10, 1000), row("B", 5, null)]);
    expect(r.lines[1].value).toBeNull();
    expect(r.totalValue).toBe(10000);
    expect(r.missingPriceCount).toBe(1);
  });

  it("rong -> tong 0", () => {
    const r = computeStockValuation([]);
    expect(r.totalValue).toBe(0);
    expect(r.missingPriceCount).toBe(0);
  });
});
