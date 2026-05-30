import { describe, it, expect } from "vitest";
import { authenticate, type AuthUserRecord } from "./authenticate";

const activeUser: AuthUserRecord = {
  id: "u1",
  username: "admin",
  passwordHash: "HASH",
  isActive: true,
};

const lookup = (username: string) =>
  Promise.resolve(username === "admin" ? activeUser : null);

const verifyTrue = () => Promise.resolve(true);
const verifyFalse = () => Promise.resolve(false);

describe("authenticate", () => {
  it("tra ve user khi dung tai khoan + mat khau", async () => {
    const u = await authenticate(lookup, verifyTrue, "admin", "x");
    expect(u?.id).toBe("u1");
  });

  it("tra ve null khi khong tim thay user", async () => {
    expect(await authenticate(lookup, verifyTrue, "khongco", "x")).toBeNull();
  });

  it("tra ve null khi sai mat khau", async () => {
    expect(await authenticate(lookup, verifyFalse, "admin", "x")).toBeNull();
  });

  it("tra ve null khi user bi khoa", async () => {
    const lockedLookup = () =>
      Promise.resolve({ ...activeUser, isActive: false });
    expect(await authenticate(lockedLookup, verifyTrue, "admin", "x")).toBeNull();
  });

  it("van goi verify khi khong tim thay user (chong do thoi gian)", async () => {
    let called = false;
    const spyVerify = () => {
      called = true;
      return Promise.resolve(false);
    };
    await authenticate(lookup, spyVerify, "khongco", "x");
    expect(called).toBe(true);
  });
});
