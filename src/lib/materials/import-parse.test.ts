import { describe, it, expect } from "vitest";
import { parseMaterialRows } from "./import-parse";

describe("parseMaterialRows", () => {
  it("phan tich dong hop le day du", () => {
    const r = parseMaterialRows([
      { "Mã": "VT01", "Tên": "Ong thep D100", "Đơn vị": "m", "Nhóm": "Ong", "Mã hiệu": "D100", "Nhãn hiệu": "Hoa Phat", "Thông số": "DN100", "Đơn giá": 150000 },
    ]);
    expect(r.errors).toHaveLength(0);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      code: "VT01", name: "Ong thep D100", unit: "m", categoryName: "Ong",
      modelCode: "D100", brandOrigin: "Hoa Phat", specification: "DN100", latestUnitPrice: 150000,
    });
  });
  it("don gia trong -> null", () => {
    const r = parseMaterialRows([{ "Mã": "VT02", "Tên": "X", "Đơn vị": "cai", "Đơn giá": "" }]);
    expect(r.items[0].latestUnitPrice).toBeNull();
  });
  it("don gia dang chuoi van parse duoc", () => {
    const r = parseMaterialRows([{ "Mã": "VT03", "Tên": "X", "Đơn vị": "cai", "Đơn giá": "2000" }]);
    expect(r.items[0].latestUnitPrice).toBe(2000);
  });
  it("dong thieu ma -> loi, khong vao items", () => {
    const r = parseMaterialRows([{ "Mã": "", "Tên": "X", "Đơn vị": "cai" }]);
    expect(r.items).toHaveLength(0);
    expect(r.errors[0].line).toBe(2); // dong 1 la header
  });
  it("don gia am -> loi", () => {
    const r = parseMaterialRows([{ "Mã": "VT04", "Tên": "X", "Đơn vị": "cai", "Đơn giá": -1 }]);
    expect(r.errors).toHaveLength(1);
    expect(r.items).toHaveLength(0);
  });
  it("nhieu dong: tron hop le va loi", () => {
    const r = parseMaterialRows([
      { "Mã": "A", "Tên": "Ten A", "Đơn vị": "m" },
      { "Mã": "", "Tên": "Ten B", "Đơn vị": "m" },
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
  it("trung ma trong cung file -> dong sau bao loi, khong vao items", () => {
    const r = parseMaterialRows([
      { "Mã": "VT01", "Tên": "Lan 1", "Đơn vị": "m" },
      { "Mã": "VT01", "Tên": "Lan 2", "Đơn vị": "m" },
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].name).toBe("Lan 1"); // giu dong dau, khong ghi de
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(3); // dong thu 2 cua du lieu = dong 3 trong file
  });
  it("don gia = 0 hop le", () => {
    const r = parseMaterialRows([{ "Mã": "VT05", "Tên": "X", "Đơn vị": "cai", "Đơn giá": 0 }]);
    expect(r.errors).toHaveLength(0);
    expect(r.items[0].latestUnitPrice).toBe(0);
  });
});
