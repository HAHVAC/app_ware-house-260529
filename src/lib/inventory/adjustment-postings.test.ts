// src/lib/inventory/adjustment-postings.test.ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeAdjustmentPostings } from "./adjustment-postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeAdjustmentPostings", () => {
  it("dem nhieu hon ton -> change duong, balanceAfter = dem", () => {
    const r = computeAdjustmentPostings({ m1: D(10) }, [{ materialId: "m1", countedQty: 12 }]);
    expect(r).toHaveLength(1);
    expect(r[0].change.toString()).toBe("2");
    expect(r[0].balanceAfter.toString()).toBe("12");
  });

  it("dem it hon ton -> change am", () => {
    const r = computeAdjustmentPostings({ m1: D(10) }, [{ materialId: "m1", countedQty: 7 }]);
    expect(r[0].change.toString()).toBe("-3");
    expect(r[0].balanceAfter.toString()).toBe("7");
  });

  it("dem bang ton -> bo qua (change 0)", () => {
    const r = computeAdjustmentPostings({ m1: D(5) }, [{ materialId: "m1", countedQty: 5 }]);
    expect(r).toHaveLength(0);
  });

  it("vat tu chua co ton -> tao tu 0", () => {
    const r = computeAdjustmentPostings({}, [{ materialId: "m9", countedQty: 3 }]);
    expect(r[0].change.toString()).toBe("3");
    expect(r[0].balanceAfter.toString()).toBe("3");
  });

  it("nhieu dong tron lan", () => {
    const r = computeAdjustmentPostings({ m1: D(10), m2: D(2) }, [
      { materialId: "m1", countedQty: 10 }, // bo qua
      { materialId: "m2", countedQty: 0 },  // change -2
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].materialId).toBe("m2");
    expect(r[0].change.toString()).toBe("-2");
  });
});
