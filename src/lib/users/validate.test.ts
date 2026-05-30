import { describe, it, expect } from "vitest";
import { validateUserInput } from "./validate";

describe("validateUserInput", () => {
  it("hop le voi du lieu day du", () => {
    const r = validateUserInput({
      fullName: "Nguyen Van A",
      username: "nva",
      password: "matkhau1",
      companyRole: "ADMIN",
    });
    expect(r.ok).toBe(true);
  });

  it("bao loi khi thieu ho ten", () => {
    const r = validateUserInput({ fullName: " ", username: "nva", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi username co khoang trang", () => {
    const r = validateUserInput({ fullName: "A", username: "nguyen a", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi mat khau qua ngan", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "123", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi companyRole khong hop le", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "matkhau1", companyRole: "BOSS" as never });
    expect(r.ok).toBe(false);
  });

  it("cho phep companyRole null", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(true);
  });

  it("bo qua kiem tra mat khau khi requirePassword = false (sua user)", () => {
    const r = validateUserInput(
      { fullName: "A", username: "nva", password: "", companyRole: null },
      { requirePassword: false },
    );
    expect(r.ok).toBe(true);
  });
});
