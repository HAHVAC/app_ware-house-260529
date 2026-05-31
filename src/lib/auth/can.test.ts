import { describe, it, expect } from "vitest";
import { canCreateReceipt } from "./can";

describe("canCreateReceipt", () => {
  const keeperW1 = [{ warehouseId: "w1", siteRole: "KEEPER" as const }];
  it("ADMIN duoc moi kho", () => {
    expect(canCreateReceipt({ companyRole: "ADMIN" }, [], "w1")).toBe(true);
  });
  it("KEEPER cua kho do -> duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, keeperW1, "w1")).toBe(true);
  });
  it("KEEPER kho khac -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, keeperW1, "w2")).toBe(false);
  });
  it("vai tro khac (TECHNICIAN) -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, [{ warehouseId: "w1", siteRole: "TECHNICIAN" as const }], "w1")).toBe(false);
  });
  it("ACCOUNTANT khong phai keeper -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: "ACCOUNTANT" }, [], "w1")).toBe(false);
  });
});
