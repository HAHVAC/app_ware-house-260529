import { describe, it, expect } from "vitest";
import { parseHistoryFilters } from "./history-filters";

describe("parseHistoryFilters", () => {
  it("parse ngay hop le (local), to = cuoi ngay", () => {
    const f = parseHistoryFilters({ from: "2026-01-01", to: "2026-01-31" });
    expect(f.from?.getFullYear()).toBe(2026);
    expect(f.from?.getMonth()).toBe(0);
    expect(f.from?.getDate()).toBe(1);
    expect(f.from?.getHours()).toBe(0);
    expect(f.to?.getDate()).toBe(31);
    expect(f.to?.getHours()).toBe(23);
    expect(f.to?.getMinutes()).toBe(59);
  });

  it("ngay sai dinh dang -> null", () => {
    const f = parseHistoryFilters({ from: "bậy", to: "" });
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
  });

  it("type trong danh sach cho phep", () => {
    expect(parseHistoryFilters({ type: "ISSUE" }).type).toBe("ISSUE");
    expect(parseHistoryFilters({ type: "TRANSFER" }).type).toBe("TRANSFER");
    expect(parseHistoryFilters({ type: "XYZ" }).type).toBeNull();
  });

  it("warehouse/material giu nguyen khi co", () => {
    const f = parseHistoryFilters({ w: "wh1", m: "mat1" });
    expect(f.warehouseId).toBe("wh1");
    expect(f.materialId).toBe("mat1");
  });
});
