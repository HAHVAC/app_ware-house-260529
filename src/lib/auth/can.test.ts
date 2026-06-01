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

import {
  canCreateTransfer, canApproveTransfer, canCreateAdjustment, canApproveAdjustment, canModifyPendingDoc,
} from "./can";

const t5_tech = { id: "u-tech", companyRole: null };
const t5_cmd = { id: "u-cmd", companyRole: null };
const t5_keeper = { id: "u-keep", companyRole: null };
const t5_admin = { id: "u-admin", companyRole: "ADMIN" as const };
const t5_A = (warehouseId: string, siteRole: "KEEPER" | "TECHNICIAN" | "COMMANDER" | "DEPUTY") => ({ warehouseId, siteRole });

describe("canCreateTransfer", () => {
  it("ADMIN luon duoc", () => { expect(canCreateTransfer(t5_admin, [], "w1")).toBe(true); });
  it("TECHNICIAN cua kho nguon duoc", () => { expect(canCreateTransfer(t5_tech, [t5_A("w1", "TECHNICIAN")], "w1")).toBe(true); });
  it("khac kho -> khong", () => { expect(canCreateTransfer(t5_tech, [t5_A("w2", "TECHNICIAN")], "w1")).toBe(false); });
});
describe("canApproveTransfer", () => {
  it("nguoi lap khong tu duyet", () => { expect(canApproveTransfer(t5_cmd, [t5_A("w1", "COMMANDER")], "w1", "u-cmd")).toBe(false); });
  it("COMMANDER kho nguon, khac nguoi lap -> duoc", () => { expect(canApproveTransfer(t5_cmd, [t5_A("w1", "COMMANDER")], "w1", "u-other")).toBe(true); });
  it("DEPUTY kho nguon -> duoc", () => { expect(canApproveTransfer(t5_cmd, [t5_A("w1", "DEPUTY")], "w1", "u-other")).toBe(true); });
  it("ADMIN khac nguoi lap -> duoc", () => { expect(canApproveTransfer(t5_admin, [], "w1", "u-other")).toBe(true); });
});
describe("canCreateAdjustment", () => {
  it("KEEPER cua kho -> duoc", () => { expect(canCreateAdjustment(t5_keeper, [t5_A("w1", "KEEPER")], "w1")).toBe(true); });
  it("TECHNICIAN -> khong", () => { expect(canCreateAdjustment(t5_tech, [t5_A("w1", "TECHNICIAN")], "w1")).toBe(false); });
  it("ADMIN -> duoc", () => { expect(canCreateAdjustment(t5_admin, [], "w1")).toBe(true); });
});
describe("canApproveAdjustment", () => {
  it("nguoi lap khong tu duyet", () => { expect(canApproveAdjustment(t5_cmd, [t5_A("w1", "COMMANDER")], "w1", "u-cmd")).toBe(false); });
  it("COMMANDER khac nguoi lap -> duoc", () => { expect(canApproveAdjustment(t5_cmd, [t5_A("w1", "COMMANDER")], "w1", "u-other")).toBe(true); });
});
describe("canModifyPendingDoc", () => {
  it("PENDING + dung nguoi lap -> duoc", () => { expect(canModifyPendingDoc({ id: "u1", companyRole: null }, { status: "PENDING", createdById: "u1" })).toBe(true); });
  it("PENDING + ADMIN -> duoc", () => { expect(canModifyPendingDoc(t5_admin, { status: "PENDING", createdById: "u-other" })).toBe(true); });
  it("khong PENDING -> khong", () => { expect(canModifyPendingDoc({ id: "u1", companyRole: null }, { status: "APPROVED", createdById: "u1" })).toBe(false); });
});
