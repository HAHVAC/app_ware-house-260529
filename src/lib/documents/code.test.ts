import { describe, it, expect } from "vitest";
import { documentCodePrefix, formatDocumentCode } from "./code";

describe("document code", () => {
  it("tien to theo loai phieu", () => {
    expect(documentCodePrefix("RECEIPT")).toBe("PN");
    expect(documentCodePrefix("ISSUE")).toBe("PX");
    expect(documentCodePrefix("TRANSFER")).toBe("PC");
    expect(documentCodePrefix("ADJUSTMENT")).toBe("KK");
  });
  it("dinh dang co padding 4 chu so", () => {
    expect(formatDocumentCode("PN", 2026, 1)).toBe("PN-2026-0001");
    expect(formatDocumentCode("PN", 2026, 42)).toBe("PN-2026-0042");
    expect(formatDocumentCode("PN", 2026, 12345)).toBe("PN-2026-12345");
  });
});
