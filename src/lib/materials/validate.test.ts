import { describe, it, expect } from "vitest";
import { validateMaterialInput } from "./validate";

const base = { code: "VT01", name: "Ong thep", unit: "m", price: 1000 as number | null };

describe("validateMaterialInput", () => {
  it("hop le voi du lieu day du", () => {
    expect(validateMaterialInput(base).ok).toBe(true);
  });
  it("hop le khi gia null", () => {
    expect(validateMaterialInput({ ...base, price: null }).ok).toBe(true);
  });
  it("loi khi thieu ma", () => {
    expect(validateMaterialInput({ ...base, code: " " }).ok).toBe(false);
  });
  it("loi khi thieu ten", () => {
    expect(validateMaterialInput({ ...base, name: "" }).ok).toBe(false);
  });
  it("loi khi thieu don vi", () => {
    expect(validateMaterialInput({ ...base, unit: "" }).ok).toBe(false);
  });
  it("loi khi gia am", () => {
    expect(validateMaterialInput({ ...base, price: -5 }).ok).toBe(false);
  });
  it("loi khi gia khong phai so", () => {
    expect(validateMaterialInput({ ...base, price: NaN }).ok).toBe(false);
  });
});
