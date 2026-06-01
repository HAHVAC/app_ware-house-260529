import { describe, it, expect } from "vitest";
import { validateTransferRequest } from "./validate-transfer";
const okLines = [{ materialId: "m1", qty: 2 }];
describe("validateTransferRequest", () => {
  it("thieu kho nguon -> loi", () => { expect(validateTransferRequest({ sourceWarehouseId: "", targetWarehouseId: "b", lines: okLines }).ok).toBe(false); });
  it("thieu kho dich -> loi", () => { expect(validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "", lines: okLines }).ok).toBe(false); });
  it("nguon trung dich -> loi", () => { expect(validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "a", lines: okLines }).ok).toBe(false); });
  it("khong co dong -> loi", () => { expect(validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: [] }).ok).toBe(false); });
  it("so luong <= 0 -> loi", () => { expect(validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: [{ materialId: "m1", qty: 0 }] }).ok).toBe(false); });
  it("hop le -> ok", () => { expect(validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: okLines }).ok).toBe(true); });
});
