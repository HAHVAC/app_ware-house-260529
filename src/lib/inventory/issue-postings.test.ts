import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeIssuePostings } from "./issue-postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeIssuePostings", () => {
  it("du ton -> tru dung, balanceAfter = con lai", () => {
    const r = computeIssuePostings({ m1: D(10) }, [{ materialId: "m1", qty: 4 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postings[0].change.toString()).toBe("-4");
      expect(r.postings[0].balanceAfter.toString()).toBe("6");
    }
  });

  it("xuat het -> balanceAfter = 0", () => {
    const r = computeIssuePostings({ m1: D(5) }, [{ materialId: "m1", qty: 5 }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postings[0].balanceAfter.toString()).toBe("0");
  });

  it("khong du ton -> ok=false, liet ke thieu", () => {
    const r = computeIssuePostings({ m1: D(3) }, [{ materialId: "m1", qty: 5 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.insufficient).toHaveLength(1);
      expect(r.insufficient[0].materialId).toBe("m1");
      expect(r.insufficient[0].available.toString()).toBe("3");
      expect(r.insufficient[0].needed.toString()).toBe("5");
    }
  });

  it("vat tu chua co ton -> thieu (available 0)", () => {
    const r = computeIssuePostings({}, [{ materialId: "m9", qty: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.insufficient[0].available.toString()).toBe("0");
  });

  it("nhieu dong cung vat tu -> gop tong roi kiem tra", () => {
    const r = computeIssuePostings({ m1: D(10) }, [
      { materialId: "m1", qty: 6 },
      { materialId: "m1", qty: 5 },
    ]);
    expect(r.ok).toBe(false);
  });

  it("bo qua dong qty <= 0", () => {
    const r = computeIssuePostings({ m1: D(10) }, [
      { materialId: "m1", qty: 0 },
      { materialId: "m1", qty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postings[0].balanceAfter.toString()).toBe("8");
  });
});
