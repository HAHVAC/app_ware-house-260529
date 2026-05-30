import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("bam mat khau khac voi ban ro", async () => {
    const hash = await hashPassword("matkhau123");
    expect(hash).not.toBe("matkhau123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verify dung tra ve true voi mat khau dung", async () => {
    const hash = await hashPassword("matkhau123");
    expect(await verifyPassword("matkhau123", hash)).toBe(true);
  });

  it("verify tra ve false voi mat khau sai", async () => {
    const hash = await hashPassword("matkhau123");
    expect(await verifyPassword("saibet", hash)).toBe(false);
  });
});
