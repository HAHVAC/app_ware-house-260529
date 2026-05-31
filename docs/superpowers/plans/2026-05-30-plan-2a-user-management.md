# Kế hoạch 2a — Quản lý người dùng (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho Quản lý (ADMIN) tạo / sửa / vô hiệu hóa tài khoản người dùng qua giao diện, và thêm thanh điều hướng khu quản trị.

**Architecture:** Tiếp nối nền tảng Kế hoạch 1. Tách validation thuần (`validateUserInput`) ra để unit-test theo TDD; thao tác DB nằm trong server actions, được bảo vệ bằng guard `requireAdmin()` (kiểm tra phía máy chủ). Thêm helper `requireUser`/`requireAdmin` dùng chung và bọc `getCurrentUser` bằng React `cache()` để tránh truy vấn lặp trong một request.

**Tech Stack:** Next.js 16 (App Router, server actions) · TypeScript · Prisma v7 · bcryptjs (đã có) · Vitest.

> **Spec nguồn:** `docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md` (mục 3.1 `User`, mục 4 phân quyền). Nối tiếp `docs/superpowers/plans/2026-05-30-plan-1-foundation-auth.md`.

---

## Quyết định thiết kế (đã chốt)
- Chỉ **ADMIN** truy cập khu `/users`.
- "Xóa" user = đặt `isActive = false` (vô hiệu hóa). **Không xóa cứng** (giữ tham chiếu lịch sử về sau).
- **Không cho admin tự vô hiệu hóa HOẶC tự hạ quyền (đổi khỏi ADMIN) chính tài khoản đang đăng nhập** — tránh tự khóa mình ra khỏi khu quản trị (đặc biệt khi chỉ còn 1 admin).
- **Bắt lỗi unique-constraint (P2002)** khi tạo trùng username để báo thân thiện thay vì văng lỗi 500 (đề phòng đua đồng thời).
- `username` đặt lúc tạo, **không sửa** ở trang sửa. Được sửa: `fullName`, `companyRole`, `isActive`, và **đặt lại mật khẩu** (tùy chọn).
- `companyRole` có thể để trống (null) — dành cho user chỉ có vai trò tại kho (gán ở Kế hoạch 2b).

## File Structure (Kế hoạch 2a)

| File | Trách nhiệm |
|---|---|
| `src/lib/auth/current-user.ts` (sửa) | Bọc `getCurrentUser` bằng `cache()` |
| `src/lib/auth/guards.ts` (mới) | `requireUser()`, `requireAdmin()` |
| `src/lib/users/validate.ts` (+ `.test.ts`) | `validateUserInput()` thuần (TDD) |
| `src/lib/users/actions.ts` (mới) | server actions: `createUserAction`, `updateUserAction` |
| `src/app/(app)/layout.tsx` (sửa) | Thêm thanh điều hướng (menu), link admin có điều kiện |
| `src/app/(app)/users/page.tsx` | Danh sách người dùng |
| `src/app/(app)/users/new/page.tsx` | Form tạo người dùng |
| `src/app/(app)/users/[id]/page.tsx` | Form sửa người dùng |

---

## Task 1: Helper phân quyền + cache getCurrentUser

**Files:**
- Modify: `src/lib/auth/current-user.ts`
- Create: `src/lib/auth/guards.ts`

- [ ] **Step 1: Bọc `getCurrentUser` bằng `cache()`**

Sửa `src/lib/auth/current-user.ts` thành:
```ts
import { cache } from "react";
import { getSession } from "./session";
import { db } from "@/lib/db";

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  return user;
});
```

- [ ] **Step 2: Tạo `src/lib/auth/guards.ts`**

```ts
import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";

/** Trả về user đang đăng nhập, hoặc chuyển hướng /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Trả về user nếu là ADMIN, ngược lại chuyển về trang chủ. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.companyRole !== "ADMIN") redirect("/");
  return user;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**
```
git add -A
git commit -m "feat: guard requireUser/requireAdmin + cache getCurrentUser"
```
(kèm trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

## Task 2: Thanh điều hướng khu quản trị

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Thêm menu điều hướng vào layout**

Thay nội dung `src/app/(app)/layout.tsx` bằng (giữ logic redirect + logout, thêm `<nav>`):
```tsx
import Link from "next/link";
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

  const isAdmin = user.companyRole === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Quản lý Kho</span>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-gray-700 hover:text-blue-600">Tổng quan</Link>
            {isAdmin && (
              <Link href="/users" className="text-gray-700 hover:text-blue-600">Người dùng</Link>
            )}
          </nav>
        </div>
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

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: them thanh dieu huong khu quan tri"
```

---

## Task 3: Validation người dùng (TDD)

**Files:**
- Create: `src/lib/users/validate.ts`
- Test: `src/lib/users/validate.test.ts`

- [ ] **Step 1: Viết test thất bại** — Create `src/lib/users/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateUserInput } from "./validate";

describe("validateUserInput", () => {
  it("hop le voi du lieu day du", () => {
    const r = validateUserInput({
      fullName: "Nguyen Van A",
      username: "nva",
      password: "matkhau1",
      companyRole: "ADMIN",
    });
    expect(r.ok).toBe(true);
  });

  it("bao loi khi thieu ho ten", () => {
    const r = validateUserInput({ fullName: " ", username: "nva", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi username co khoang trang", () => {
    const r = validateUserInput({ fullName: "A", username: "nguyen a", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi mat khau qua ngan", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "123", companyRole: null });
    expect(r.ok).toBe(false);
  });

  it("bao loi khi companyRole khong hop le", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "matkhau1", companyRole: "BOSS" as never });
    expect(r.ok).toBe(false);
  });

  it("cho phep companyRole null", () => {
    const r = validateUserInput({ fullName: "A", username: "nva", password: "matkhau1", companyRole: null });
    expect(r.ok).toBe(true);
  });

  it("bo qua kiem tra mat khau khi requirePassword = false (sua user)", () => {
    const r = validateUserInput(
      { fullName: "A", username: "nva", password: "", companyRole: null },
      { requirePassword: false },
    );
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL** — `npx vitest run src/lib/users/validate.test.ts` → FAIL (module chưa có).

- [ ] **Step 3: Viết implementation** — Create `src/lib/users/validate.ts`:
```ts
export type CompanyRoleInput = "ADMIN" | "ACCOUNTANT" | null;

export interface UserInput {
  fullName: string;
  username: string;
  password: string;
  companyRole: CompanyRoleInput;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 6;
const VALID_ROLES = ["ADMIN", "ACCOUNTANT"];

export function validateUserInput(
  input: UserInput,
  opts: { requirePassword?: boolean } = {},
): ValidateResult {
  const { requirePassword = true } = opts;

  if (!input.fullName || !input.fullName.trim()) {
    return { ok: false, error: "Vui lòng nhập họ tên" };
  }
  if (!input.username || !input.username.trim()) {
    return { ok: false, error: "Vui lòng nhập tài khoản" };
  }
  if (/\s/.test(input.username)) {
    return { ok: false, error: "Tài khoản không được chứa khoảng trắng" };
  }
  if (requirePassword || input.password) {
    if (input.password.length < MIN_PASSWORD) {
      return { ok: false, error: `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự` };
    }
  }
  if (input.companyRole !== null && !VALID_ROLES.includes(input.companyRole)) {
    return { ok: false, error: "Vai trò không hợp lệ" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS** — `npx vitest run src/lib/users/validate.test.ts` → PASS (7 tests).

- [ ] **Step 5: Commit**
```
git add -A
git commit -m "feat: validate du lieu nguoi dung (TDD)"
```

---

## Task 4: Server actions tạo/sửa người dùng

**Files:**
- Create: `src/lib/users/actions.ts`

> Server actions: bảo vệ bằng `requireAdmin()`, validate bằng `validateUserInput()`, băm mật khẩu bằng `hashPassword()`. Trả về state lỗi (giống login) để form hiển thị.

- [ ] **Step 1: Tạo `src/lib/users/actions.ts`**
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { validateUserInput, type CompanyRoleInput } from "./validate";

export interface UserFormState {
  error?: string;
}

function readRole(formData: FormData): CompanyRoleInput {
  const raw = String(formData.get("companyRole") ?? "");
  return raw === "ADMIN" || raw === "ACCOUNTANT" ? raw : null;
}

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyRole = readRole(formData);

  const v = validateUserInput({ fullName, username, password, companyRole });
  if (!v.ok) return { error: v.error };

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return { error: "Tài khoản đã tồn tại" };

  await db.user.create({
    data: { fullName, username, passwordHash: await hashPassword(password), companyRole },
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? ""); // rỗng = không đổi
  const companyRole = readRole(formData);
  const isActive = formData.get("isActive") === "on";

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy người dùng" };

  // username không sửa; validate phần còn lại, không bắt buộc mật khẩu
  const v = validateUserInput(
    { fullName, username: target.username, password, companyRole },
    { requirePassword: false },
  );
  if (!v.ok) return { error: v.error };

  // Không cho tự vô hiệu hóa chính mình
  if (admin.id === id && !isActive) {
    return { error: "Không thể tự vô hiệu hóa tài khoản đang đăng nhập" };
  }

  await db.user.update({
    where: { id },
    data: {
      fullName,
      companyRole,
      isActive,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  revalidatePath("/users");
  redirect("/users");
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: server actions tao/sua nguoi dung"
```

---

## Task 5: Trang danh sách người dùng

**Files:**
- Create: `src/app/(app)/users/page.tsx`

- [ ] **Step 1: Tạo `src/app/(app)/users/page.tsx`**
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const roleLabel: Record<string, string> = {
  ADMIN: "Quản lý",
  ACCOUNTANT: "Kế toán/Mua hàng",
};

export default async function UsersPage() {
  await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Người dùng</h1>
        <Link href="/users/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
          + Thêm người dùng
        </Link>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Tài khoản</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.companyRole ? roleLabel[u.companyRole] : "—"}</td>
                <td className="px-3 py-2">
                  {u.isActive
                    ? <span className="text-green-600">Đang hoạt động</span>
                    : <span className="text-gray-400">Đã khóa</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/users/${u.id}`} className="text-blue-600 hover:underline">Sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: trang danh sach nguoi dung"
```

---

## Task 6: Trang tạo người dùng

**Files:**
- Create: `src/app/(app)/users/new/page.tsx`

> Form client dùng `useActionState(createUserAction, {})`. Vì server action được bảo vệ `requireAdmin`, ta vẫn gọi `requireAdmin()` trong một server component bọc ngoài để chặn truy cập trang. Cách gọn: tạo trang là server component, render form client bên trong.

- [ ] **Step 1: Tạo form client + trang** — Create `src/app/(app)/users/new/page.tsx`:
```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { UserCreateForm } from "./form";

export default async function NewUserPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Thêm người dùng</h1>
      <UserCreateForm />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/app/(app)/users/new/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createUserAction, type UserFormState } from "@/lib/users/actions";

const initial: UserFormState = {};

export function UserCreateForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fullName">Họ tên</label>
        <input id="fullName" name="fullName" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="username">Tài khoản</label>
        <input id="username" name="username" required autoComplete="off" className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
        <input id="password" name="password" type="password" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="companyRole">Vai trò công ty</label>
        <select id="companyRole" name="companyRole" className="w-full border rounded-lg px-3 py-2" defaultValue="">
          <option value="">— Không (chỉ vai trò tại kho) —</option>
          <option value="ADMIN">Quản lý</option>
          <option value="ACCOUNTANT">Kế toán/Mua hàng</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/users" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 4: Commit**
```
git add -A
git commit -m "feat: trang tao nguoi dung"
```

---

## Task 7: Trang sửa người dùng

**Files:**
- Create: `src/app/(app)/users/[id]/page.tsx`
- Create: `src/app/(app)/users/[id]/form.tsx`

- [ ] **Step 1: Tạo trang sửa** — Create `src/app/(app)/users/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { UserEditForm } from "./form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Sửa người dùng</h1>
      <UserEditForm
        user={{
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          companyRole: user.companyRole,
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/app/(app)/users/[id]/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateUserAction, type UserFormState } from "@/lib/users/actions";

interface Props {
  user: {
    id: string;
    fullName: string;
    username: string;
    companyRole: "ADMIN" | "ACCOUNTANT" | null;
    isActive: boolean;
  };
}

const initial: UserFormState = {};

export function UserEditForm({ user }: Props) {
  const [state, action, pending] = useActionState(updateUserAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={user.id} />

      <div className="space-y-1">
        <label className="text-sm font-medium">Tài khoản</label>
        <input value={user.username} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="fullName">Họ tên</label>
        <input id="fullName" name="fullName" required defaultValue={user.fullName}
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Mật khẩu mới (để trống nếu không đổi)</label>
        <input id="password" name="password" type="password" autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="companyRole">Vai trò công ty</label>
        <select id="companyRole" name="companyRole" defaultValue={user.companyRole ?? ""}
          className="w-full border rounded-lg px-3 py-2">
          <option value="">— Không (chỉ vai trò tại kho) —</option>
          <option value="ADMIN">Quản lý</option>
          <option value="ACCOUNTANT">Kế toán/Mua hàng</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
        Đang hoạt động
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/users" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check + build** — `npx tsc --noEmit` rồi `npm run build` (không lỗi, routes `/users`, `/users/new`, `/users/[id]` xuất hiện).

- [ ] **Step 4: Commit**
```
git add -A
git commit -m "feat: trang sua nguoi dung"
```

---

## Task 8: Kiểm thử end-to-end + toàn bộ test

- [ ] **Step 1: Chạy toàn bộ unit test** — `npm test` → tất cả PASS (password 3 + authenticate 5 + validateUserInput 7 = 15).

- [ ] **Step 2: Khởi động** — `npm run dev`, đăng nhập `admin`/`admin123`.

- [ ] **Step 3: Kiểm thử luồng (đăng nhập bằng admin):**
  - Menu hiện link **"Người dùng"** → mở `/users`, thấy tài khoản admin.
  - **Thêm người dùng**: tạo 1 user mới (vd thủ kho, vai trò để trống) → quay lại danh sách, thấy user mới.
  - Thử tạo trùng `username` → báo "Tài khoản đã tồn tại". Thử mật khẩu < 6 ký tự → báo lỗi.
  - **Sửa**: đổi họ tên, đặt lại mật khẩu, bật/tắt "Đang hoạt động" cho user khác → lưu OK.
  - Mở trang sửa **chính tài khoản admin**, bỏ tick "Đang hoạt động", Lưu → báo "Không thể tự vô hiệu hóa tài khoản đang đăng nhập".
  - Đăng nhập bằng user mới (vai trò trống/không phải ADMIN) → **không thấy link "Người dùng"**; gõ thẳng `/users` → bị đẩy về trang tổng quan.

- [ ] **Step 4:** Báo kết quả. (Không cần commit thêm nếu chỉ kiểm thử.)

---

## Hoàn thành Kế hoạch 2a
Quản lý người dùng đầy đủ (tạo/sửa/khóa), có điều hướng và phân quyền ADMIN. Sẵn sàng cho **Kế hoạch 2b** (Công trình/Kho + phân công nhân sự — sẽ gán user vào kho theo 4 vai trò).

**Out of scope (kế hoạch sau):** CRUD công trình/kho & phân công (2b), CRUD vật tư + import Excel (2c), mọi nghiệp vụ phiếu/tồn kho.
