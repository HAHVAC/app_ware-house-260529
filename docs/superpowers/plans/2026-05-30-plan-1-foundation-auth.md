# Kế hoạch 1 — Nền tảng & Đăng nhập (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền tảng dự án (Next.js + TypeScript + Prisma + PostgreSQL) và chức năng đăng nhập/đăng xuất có phân quyền cơ bản, để các kế hoạch sau xây tiếp.

**Architecture:** Một app Next.js (App Router). Logic xác thực tách thành các module thuần, dễ unit-test: `password` (băm mật khẩu), `authenticate` (kiểm tra user, tiêm phụ thuộc lookup + verify). Phiên đăng nhập lưu trong cookie mã hóa HTTP-only (`iron-session`). Route được bảo vệ qua layout server-side gọi `getCurrentUser()`.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Prisma + PostgreSQL · Tailwind CSS · `iron-session` · `bcryptjs` · Vitest (unit test).

> **Spec nguồn:** `docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md` (mục 2, 3.1, 4).

---

## File Structure (Kế hoạch 1)

| File | Trách nhiệm |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` | Cấu hình dự án & test runner |
| `.env.example`, `.env` | `DATABASE_URL`, `SESSION_SECRET` |
| `prisma/schema.prisma` | Model `User` + enum `CompanyRole` |
| `prisma/seed.ts` | Tạo tài khoản Quản lý ban đầu |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/auth/password.ts` (+ `.test.ts`) | `hashPassword`, `verifyPassword` |
| `src/lib/auth/authenticate.ts` (+ `.test.ts`) | `authenticate(lookup, verify, username, password)` |
| `src/lib/auth/session.ts` | Cấu hình & truy cập `iron-session` |
| `src/lib/auth/current-user.ts` | `getCurrentUser()` đọc session + tải user + kiểm tra `isActive` |
| `src/app/login/page.tsx`, `src/app/login/actions.ts` | Trang & server action đăng nhập |
| `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/app/(app)/page.tsx` | Layout bảo vệ + đăng xuất + dashboard tạm |

---

## Yêu cầu môi trường (làm trước Task 1)

- Cần một **PostgreSQL** đang chạy. Cách nhanh nhất khi dev: Docker.
  - `docker run --name wms-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wms -p 5432:5432 -d postgres:16`
  - Nếu không có Docker, cài Postgres cục bộ và tạo database tên `wms`.
- `DATABASE_URL` mẫu: `postgresql://postgres:postgres@localhost:5432/wms?schema=public`

---

## Task 1: Khởi tạo dự án Next.js + Vitest

**Files:**
- Create: toàn bộ scaffold Next.js trong thư mục hiện tại
- Create: `vitest.config.ts`
- Modify: `package.json` (thêm script test)

- [ ] **Step 1: Tạo scaffold Next.js vào thư mục hiện tại**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
```
Expected: tạo `src/app/`, `package.json`, `tsconfig.json`, `next.config.ts`, cấu hình Tailwind. Nếu hỏi ghi đè khi thư mục đã có `.git`/`docs`, chọn tiếp tục (không xóa `docs/` và `.git/`).

- [ ] **Step 2: Cài Vitest**

Run:
```bash
npm install -D vitest @vitejs/plugin-react
```
Expected: cài thành công.

- [ ] **Step 3: Tạo `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Thêm script test vào `package.json`**

Trong `"scripts"` thêm:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Tạo test khói (smoke) để xác nhận Vitest chạy**

Create `src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Chạy test khói**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: khoi tao Next.js + Tailwind + Vitest"
```

---

## Task 2: Prisma + PostgreSQL + model User

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `.env`, `.env.example`
- Modify: `package.json` (script prisma, cấu hình seed)

- [ ] **Step 1: Cài Prisma**

Run:
```bash
npm install @prisma/client
npm install -D prisma tsx
```

- [ ] **Step 2: Tạo `.env` và `.env.example`**

`.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wms?schema=public"
SESSION_SECRET="doi-thanh-chuoi-ngau-nhien-it-nhat-32-ky-tu-xxxxxx"
```
`.env.example` (giống nhưng để trống giá trị bí mật):
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/wms?schema=public"
SESSION_SECRET="chuoi-ngau-nhien-toi-thieu-32-ky-tu"
```
Đảm bảo `.env` nằm trong `.gitignore` (create-next-app đã thêm `.env*`). Giữ `.env.example` được track.

- [ ] **Step 3: Tạo `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CompanyRole {
  ADMIN
  ACCOUNTANT
}

model User {
  id           String       @id @default(uuid())
  fullName     String
  username     String       @unique
  passwordHash String
  companyRole  CompanyRole?
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
}
```

- [ ] **Step 4: Tạo migration đầu tiên**

Run: `npx prisma migrate dev --name init_user`
Expected: tạo thư mục `prisma/migrations/...`, tạo bảng `User` trong DB, sinh Prisma Client.

- [ ] **Step 5: Tạo Prisma client singleton `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: them Prisma + model User + migration init"
```

---

## Task 3: Module băm mật khẩu (TDD)

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `src/lib/auth/password.test.ts`

- [ ] **Step 1: Cài bcryptjs**

Run:
```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```
> Dùng `bcryptjs` (thuần JS) để tránh lỗi build native trên Windows.

- [ ] **Step 2: Viết test thất bại**

Create `src/lib/auth/password.test.ts`:
```ts
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
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/auth/password.test.ts`
Expected: FAIL ("Cannot find module './password'").

- [ ] **Step 4: Viết implementation tối thiểu**

Create `src/lib/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/auth/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: module bam/kiem tra mat khau (TDD)"
```

---

## Task 4: Service `authenticate` (TDD)

**Files:**
- Create: `src/lib/auth/authenticate.ts`
- Test: `src/lib/auth/authenticate.test.ts`

> Thiết kế tiêm phụ thuộc (`lookup`, `verify`) để test thuần, không cần DB.

- [ ] **Step 1: Viết test thất bại**

Create `src/lib/auth/authenticate.test.ts`:
```ts
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
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/lib/auth/authenticate.test.ts`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết implementation tối thiểu**

Create `src/lib/auth/authenticate.ts`:
```ts
export interface AuthUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  isActive: boolean;
}

export type UserLookup = (username: string) => Promise<AuthUserRecord | null>;
export type PasswordVerify = (plain: string, hash: string) => Promise<boolean>;

export async function authenticate(
  lookup: UserLookup,
  verify: PasswordVerify,
  username: string,
  password: string,
): Promise<AuthUserRecord | null> {
  const user = await lookup(username);
  if (!user || !user.isActive) return null;
  const ok = await verify(password, user.passwordHash);
  return ok ? user : null;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/lib/auth/authenticate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: service authenticate (TDD)"
```

---

## Task 5: Session (iron-session) + getCurrentUser

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/current-user.ts`

> Phần này chạm cookie/DB nên kiểm thử bằng tay (end-to-end ở Task 8). Không viết unit test cho I/O.

- [ ] **Step 1: Cài iron-session**

Run: `npm install iron-session`

- [ ] **Step 2: Tạo `src/lib/auth/session.ts`**

```ts
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "wms_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
```

- [ ] **Step 3: Tạo `src/lib/auth/current-user.ts`**

```ts
import { getSession } from "./session";
import { db } from "@/lib/db";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: session iron-session + getCurrentUser"
```

---

## Task 6: Trang đăng nhập + server action

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Tạo server action `src/app/login/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authenticate } from "@/lib/auth/authenticate";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Vui lòng nhập tài khoản và mật khẩu" };
  }

  const user = await authenticate(
    (u) => db.user.findUnique({ where: { username: u } }),
    verifyPassword,
    username,
    password,
  );

  if (!user) {
    return { error: "Sai tài khoản hoặc mật khẩu" };
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  redirect("/");
}
```

- [ ] **Step 2: Tạo trang đăng nhập `src/app/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form
        action={formAction}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">Quản lý Kho</h1>
        <p className="text-sm text-gray-500 text-center">Đăng nhập hệ thống</p>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="username">Tài khoản</label>
          <input
            id="username" name="username" autoComplete="username"
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
          <input
            id="password" name="password" type="password" autoComplete="current-password"
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit" disabled={pending}
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
        >
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: trang dang nhap + login server action"
```

---

## Task 7: Layout bảo vệ + đăng xuất + dashboard tạm

**Files:**
- Create: `src/app/(app)/actions.ts`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Delete: `src/app/page.tsx` (trang mặc định của create-next-app, nếu còn)

- [ ] **Step 1: Xóa trang chủ mặc định**

Xóa `src/app/page.tsx` mặc định (sẽ thay bằng dashboard trong route group `(app)`).

- [ ] **Step 2: Tạo action đăng xuất `src/app/(app)/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
```

- [ ] **Step 3: Tạo layout bảo vệ `src/app/(app)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logoutAction } from "./actions";

const roleLabel: Record<string, string> = {
  ADMIN: "Quản lý",
  ACCOUNTANT: "Kế toán/Mua hàng",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">Quản lý Kho</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {user.fullName}
            {user.companyRole ? ` · ${roleLabel[user.companyRole] ?? ""}` : ""}
          </span>
          <form action={logoutAction}>
            <button className="text-blue-600 hover:underline" type="submit">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Tạo dashboard tạm `src/app/(app)/page.tsx`**

```tsx
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="text-lg font-semibold">Trang tổng quan</h1>
      <p className="text-gray-600 mt-2">
        Xin chào, {user?.fullName}. Hệ thống đang được xây dựng.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: layout bao ve route + dang xuat + dashboard tam"
```

---

## Task 8: Seed tài khoản Quản lý ban đầu

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (thêm khối `"prisma": { "seed": ... }`)

- [ ] **Step 1: Tạo `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

async function main() {
  const username = "admin";
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    console.log("Tai khoan admin da ton tai, bo qua seed.");
    return;
  }
  await db.user.create({
    data: {
      fullName: "Quản trị viên",
      username,
      passwordHash: await hashPassword("admin123"),
      companyRole: "ADMIN",
      isActive: true,
    },
  });
  console.log("Da tao tai khoan admin / admin123");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Khai báo seed trong `package.json`**

Thêm ở cấp cao nhất của `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Chạy seed**

Run: `npx prisma db seed`
Expected: in "Da tao tai khoan admin / admin123".

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed tai khoan Quan ly ban dau"
```

---

## Task 9: Kiểm thử end-to-end bằng tay + chạy toàn bộ test

- [ ] **Step 1: Chạy toàn bộ unit test**

Run: `npm test`
Expected: tất cả PASS (password 3 + authenticate 4 + smoke 1).

- [ ] **Step 2: Khởi động app**

Run: `npm run dev`
Mở `http://localhost:3000`.
Expected: tự chuyển hướng sang `/login` (vì chưa đăng nhập).

- [ ] **Step 3: Đăng nhập sai**

Nhập sai mật khẩu → Expected: hiện "Sai tài khoản hoặc mật khẩu".

- [ ] **Step 4: Đăng nhập đúng**

Nhập `admin` / `admin123` → Expected: vào trang tổng quan, header hiển thị "Quản trị viên · Quản lý".

- [ ] **Step 5: Đăng xuất**

Bấm "Đăng xuất" → Expected: quay lại `/login`; truy cập `/` lại bị chuyển hướng về `/login`.

- [ ] **Step 6: (Tùy chọn) Xóa smoke test**

Xóa `src/lib/smoke.test.ts`, chạy lại `npm test` để chắc vẫn PASS, rồi commit.
```bash
git add -A
git commit -m "chore: don dep smoke test"
```

---

## Hoàn thành Kế hoạch 1

Khi tất cả task xong: app chạy được, đăng nhập/đăng xuất hoạt động, có tài khoản Quản lý, nền tảng Prisma sẵn sàng cho Kế hoạch 2 (Danh mục dữ liệu).

**Out of scope (để kế hoạch sau):** shadcn/ui components nâng cao, CRUD vật tư/kho, phân công vai trò tại kho, mọi nghiệp vụ phiếu/tồn kho.
