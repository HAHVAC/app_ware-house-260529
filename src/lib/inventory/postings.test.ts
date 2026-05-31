import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeReceiptPostings } from "./postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeReceiptPostings", () => {
  it("vat tu chua co ton -> balanceAfter = qty", () => {
    const r = computeReceiptPostings({}, [{ materialId: "m1", qty: 10 }]);
    expect(r.postings).toHaveLength(1);
    expect(r.postings[0].balanceAfter.toString()).toBe("10");
    expect(r.postings[0].change.toString()).toBe("10");
    expect(r.newStock["m1"].toString()).toBe("10");
  });

  it("cong vao ton hien co", () => {
    const r = computeReceiptPostings({ m1: D(5) }, [{ materialId: "m1", qty: 3 }]);
    expect(r.postings[0].balanceAfter.toString()).toBe("8");
    expect(r.newStock["m1"].toString()).toBe("8");
  });

  it("nhieu dong cung vat tu -> cong don tuan tu, balanceAfter tang dan", () => {
    const r = computeReceiptPostings({}, [
      { materialId: "m1", qty: 10 },
      { materialId: "m1", qty: 5 },
    ]);
    expect(r.postings.map((p) => p.balanceAfter.toString())).toEqual(["10", "15"]);
    expect(r.newStock["m1"].toString()).toBe("15");
  });

  it("nhieu vat tu doc lap", () => {
    const r = computeReceiptPostings({ m2: D(2) }, [
      { materialId: "m1", qty: 1 },
      { materialId: "m2", qty: 4 },
    ]);
    expect(r.newStock["m1"].toString()).toBe("1");
    expect(r.newStock["m2"].toString()).toBe("6");
  });

  it("so luong thap phan", () => {
    const r = computeReceiptPostings({}, [{ materialId: "m1", qty: 1.5 }]);
    expect(r.newStock["m1"].toString()).toBe("1.5");
  });
});
