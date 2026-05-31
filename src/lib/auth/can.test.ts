import { describe, it, expect } from "vitest";
import { canCreateReceipt } from "./can";
import {
  canCreateIssue,
  canApproveIssue,
  canCompleteIssue,
  canModifyPendingIssue,
} from "./can";

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

describe("canCreateIssue (de nghi xuat)", () => {
  it("ADMIN duoc", () =>
    expect(canCreateIssue({ companyRole: "ADMIN" }, [], "w1")).toBe(true));
  it("TECHNICIAN cua kho duoc", () =>
    expect(canCreateIssue({ companyRole: null }, [{ warehouseId: "w1", siteRole: "TECHNICIAN" }], "w1")).toBe(true));
  it("KEEPER khong duoc lap de nghi", () =>
    expect(canCreateIssue({ companyRole: null }, [{ warehouseId: "w1", siteRole: "KEEPER" }], "w1")).toBe(false));
});

describe("canApproveIssue (duyet) - cam tu duyet", () => {
  const commander = [{ warehouseId: "w1", siteRole: "COMMANDER" as const }];
  it("COMMANDER cua kho, khac nguoi lap -> duoc", () =>
    expect(canApproveIssue({ id: "u2", companyRole: null }, commander, "w1", "u1")).toBe(true));
  it("DEPUTY cua kho -> duoc", () =>
    expect(canApproveIssue({ id: "u2", companyRole: null }, [{ warehouseId: "w1", siteRole: "DEPUTY" }], "w1", "u1")).toBe(true));
  it("ADMIN khac nguoi lap -> duoc", () =>
    expect(canApproveIssue({ id: "u2", companyRole: "ADMIN" }, [], "w1", "u1")).toBe(true));
  it("tu duyet phieu minh lap -> KHONG duoc (ke ca ADMIN)", () => {
    expect(canApproveIssue({ id: "u1", companyRole: "ADMIN" }, [], "w1", "u1")).toBe(false);
    expect(canApproveIssue({ id: "u1", companyRole: null }, commander, "w1", "u1")).toBe(false);
  });
  it("TECHNICIAN khong duoc duyet", () =>
    expect(canApproveIssue({ id: "u2", companyRole: null }, [{ warehouseId: "w1", siteRole: "TECHNICIAN" }], "w1", "u1")).toBe(false));
});

describe("canCompleteIssue (thuc xuat)", () => {
  it("KEEPER cua kho duoc", () =>
    expect(canCompleteIssue({ companyRole: null }, [{ warehouseId: "w1", siteRole: "KEEPER" }], "w1")).toBe(true));
  it("ADMIN duoc", () =>
    expect(canCompleteIssue({ companyRole: "ADMIN" }, [], "w1")).toBe(true));
  it("COMMANDER khong phai keeper -> khong duoc", () =>
    expect(canCompleteIssue({ companyRole: null }, [{ warehouseId: "w1", siteRole: "COMMANDER" }], "w1")).toBe(false));
});

describe("canModifyPendingIssue (sua/huy cho duyet)", () => {
  it("nguoi lap, dang PENDING -> duoc", () =>
    expect(canModifyPendingIssue({ id: "u1", companyRole: null }, { status: "PENDING", createdById: "u1" })).toBe(true));
  it("ADMIN -> duoc", () =>
    expect(canModifyPendingIssue({ id: "u9", companyRole: "ADMIN" }, { status: "PENDING", createdById: "u1" })).toBe(true));
  it("nguoi khac (khong ADMIN) -> khong duoc", () =>
    expect(canModifyPendingIssue({ id: "u2", companyRole: null }, { status: "PENDING", createdById: "u1" })).toBe(false));
  it("da APPROVED -> khong duoc", () =>
    expect(canModifyPendingIssue({ id: "u1", companyRole: null }, { status: "APPROVED", createdById: "u1" })).toBe(false));
});
