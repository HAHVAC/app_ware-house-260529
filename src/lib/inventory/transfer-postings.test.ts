import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeTransferPostings } from "./transfer-postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeTransferPostings", () => {
  it("du ton nguon -> tra moves duong theo vat tu", () => {
    const r = computeTransferPostings({ m1: D(10) }, [{ materialId: "m1", qty: 4 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.moves).toHaveLength(1);
      expect(r.moves[0].materialId).toBe("m1");
      expect(r.moves[0].qty.toString()).toBe("4");
    }
  });
  it("gop nhieu dong cung vat tu", () => {
    const r = computeTransferPostings({ m1: D(10) }, [
      { materialId: "m1", qty: 3 }, { materialId: "m1", qty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.moves[0].qty.toString()).toBe("5");
  });
  it("khong du ton nguon -> ok=false, liet ke thieu", () => {
    const r = computeTransferPostings({ m1: D(3) }, [{ materialId: "m1", qty: 5 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.insufficient[0].materialId).toBe("m1");
      expect(r.insufficient[0].available.toString()).toBe("3");
      expect(r.insufficient[0].needed.toString()).toBe("5");
    }
  });
  it("vat tu khong co ton nguon -> thieu (available 0)", () => {
    const r = computeTransferPostings({}, [{ materialId: "m9", qty: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.insufficient[0].available.toString()).toBe("0");
  });
  it("bo qua dong qty <= 0", () => {
    const r = computeTransferPostings({ m1: D(10) }, [
      { materialId: "m1", qty: 0 }, { materialId: "m1", qty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.moves[0].qty.toString()).toBe("2");
  });
});
