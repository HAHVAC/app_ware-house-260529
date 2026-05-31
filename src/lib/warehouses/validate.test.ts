import { describe, it, expect } from "vitest";
import { validateWarehouseInput } from "./validate";

describe("validateWarehouseInput", () => {
  it("hop le voi du lieu day du", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "Cong trinh A", type: "PROJECT", status: "ACTIVE" }).ok).toBe(true);
  });
  it("bao loi khi thieu ma kho", () => {
    expect(validateWarehouseInput({ code: " ", name: "A", type: "PROJECT", status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi thieu ten", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "", type: "PROJECT", status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi type khong hop le", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "A", type: "X" as never, status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi status khong hop le", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "A", type: "PROJECT", status: "X" as never }).ok).toBe(false);
  });
  it("chap nhan type CENTRAL va status CLOSED", () => {
    expect(validateWarehouseInput({ code: "KT", name: "Kho tong", type: "CENTRAL", status: "CLOSED" }).ok).toBe(true);
  });
});
