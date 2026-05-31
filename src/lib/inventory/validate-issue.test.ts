import { describe, it, expect } from "vitest";
import { validateIssueRequest, validateIssueCompletion } from "./validate-issue";

describe("validateIssueRequest", () => {
  const base = { warehouseId: "w1", lines: [{ materialId: "m1", qty: 3 }] };
  it("hop le", () => expect(validateIssueRequest(base).ok).toBe(true));
  it("thieu kho", () => expect(validateIssueRequest({ ...base, warehouseId: "" }).ok).toBe(false));
  it("khong co dong", () => expect(validateIssueRequest({ ...base, lines: [] }).ok).toBe(false));
  it("qty <= 0", () =>
    expect(validateIssueRequest({ ...base, lines: [{ materialId: "m1", qty: 0 }] }).ok).toBe(false));
});

describe("validateIssueCompletion", () => {
  it("dung bang de nghi -> khong can ly do", () => {
    const r = validateIssueCompletion([{ requestedQty: 5, actualQty: 5 }], null);
    expect(r.ok).toBe(true);
  });
  it("khac de nghi & thieu ly do -> loi", () => {
    const r = validateIssueCompletion([{ requestedQty: 5, actualQty: 3 }], null);
    expect(r.ok).toBe(false);
  });
  it("khac de nghi & co ly do -> ok", () => {
    const r = validateIssueCompletion([{ requestedQty: 5, actualQty: 3 }], "Chỉ còn 3");
    expect(r.ok).toBe(true);
  });
  it("thuc xuat nhieu hon -> can ly do", () => {
    expect(validateIssueCompletion([{ requestedQty: 5, actualQty: 8 }], null).ok).toBe(false);
    expect(validateIssueCompletion([{ requestedQty: 5, actualQty: 8 }], "Lấy thêm").ok).toBe(true);
  });
  it("actualQty am -> loi", () => {
    expect(validateIssueCompletion([{ requestedQty: 5, actualQty: -1 }], "x").ok).toBe(false);
  });
  it("tong = 0 -> loi", () => {
    expect(validateIssueCompletion([{ requestedQty: 5, actualQty: 0 }], null).ok).toBe(false);
  });
});
