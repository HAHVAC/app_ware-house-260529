# Kế hoạch 2b — Công trình/Kho + Phân công nhân sự (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho Quản lý (ADMIN) tạo / sửa công trình (= kho) và phân công người dùng vào từng công trình theo 4 vai trò tại kho (Thủ kho, Cán bộ kỹ thuật, Chỉ huy trưởng, Chỉ huy phó).

**Architecture:** Tiếp nối Kế hoạch 2a. Thêm 2 model Prisma (`Warehouse`, `Assignment`) + 3 enum. Validation kho tách thuần (TDD). Server actions bảo vệ bằng `requireAdmin()`. Quản lý phân công nằm trên trang sửa công trình (liệt kê + thêm + gỡ).

**Tech Stack:** Next.js 16 (App Router, server actions) · TypeScript · Prisma v7 · Vitest.

> **Spec nguồn:** `docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md` (mục 3.2 `Warehouse`, 3.3 `Assignment`, mục 4 phân quyền). Nối tiếp Kế hoạch 2a (`requireAdmin`, `db`, nav khu quản trị, mẫu CRUD người dùng).

---

## Quyết định thiết kế (đã chốt)
- Chỉ **ADMIN** truy cập khu `/warehouses`.
- `code` (mã công trình/kho) đặt lúc tạo, **không sửa** sau. Sửa được: `name`, `type`, `address`, `status`.
- "Xóa" công trình = đặt `status = CLOSED` (Đã đóng). **Không xóa cứng** (giữ tham chiếu).
- **Phân công:** một dòng `Assignment` = (user, kho, vai trò). Một người có thể giữ nhiều vai trò ở nhiều kho. Trùng đúng (user+kho+vai trò) bị chặn bởi unique. Gỡ phân công = xóa dòng Assignment (chưa có dữ liệu lịch sử phụ thuộc ở giai đoạn này).
- `type` có `PROJECT` (Công trình) và `CENTRAL` (Kho tổng — model hỗ trợ sẵn cho tương lai); mặc định `PROJECT`.

## File Structure (Kế hoạch 2b)

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` (sửa) | Thêm `Warehouse`, `Assignment`, enum `WarehouseType`/`WarehouseStatus`/`SiteRole`; thêm quan hệ `assignments` vào `User` |
| `src/lib/warehouses/validate.ts` (+ `.test.ts`) | `validateWarehouseInput()` thuần (TDD) |
| `src/lib/warehouses/roles.ts` | hằng nhãn `siteRoleLabel` |
| `src/lib/warehouses/actions.ts` | server actions `createWarehouseAction`, `updateWarehouseAction` |
| `src/lib/warehouses/assignments.ts` | server actions `assignUserAction`, `removeAssignmentAction` |
| `src/app/(app)/layout.tsx` (sửa) | Thêm link "Công trình" (admin) |
| `src/app/(app)/warehouses/page.tsx` | Danh sách công trình |
| `src/app/(app)/warehouses/new/page.tsx` + `form.tsx` | Tạo công trình |
| `src/app/(app)/warehouses/[id]/page.tsx` + `form.tsx` + `assignments.tsx` | Sửa công trình + quản lý phân công |

---

## Task 1: Schema Prisma + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Thêm enum + model vào `prisma/schema.prisma`**

Thêm vào cuối file (và **sửa model `User`** để thêm quan hệ ngược):
```prisma
enum WarehouseType {
  PROJECT
  CENTRAL
}

enum WarehouseStatus {
  ACTIVE
  CLOSED
}

enum SiteRole {
  KEEPER
  TECHNICIAN
  COMMANDER
  DEPUTY
}

model Warehouse {
  id          String          @id @default(uuid())
  code        String          @unique
  name        String
  type        WarehouseType   @default(PROJECT)
  address     String?
  status      WarehouseStatus @default(ACTIVE)
  createdAt   DateTime        @default(now())
  assignments Assignment[]
}

model Assignment {
  id          String    @id @default(uuid())
  userId      String
  warehouseId String
  siteRole    SiteRole
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  @@unique([userId, warehouseId, siteRole])
}
```

Trong model `User` (đã có), **thêm 1 dòng quan hệ ngược**:
```prisma
  assignments  Assignment[]
```
(thêm vào trong khối `model User { ... }`, ví dụ ngay sau dòng `createdAt`.)

- [ ] **Step 2: Tạo migration**

Run: `npx prisma migrate dev --name add_warehouse_assignment`
Expected: tạo bảng `Warehouse`, `Assignment`, 3 enum; sinh lại Prisma Client. (Lệnh đọc `.env` đã sẵn.)

- [ ] **Step 3: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 4: Commit**
```
git add -A
git commit -m "feat: model Warehouse + Assignment + migration"
```
(kèm trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

## Task 2: Nhãn vai trò + Validation kho (TDD)

**Files:**
- Create: `src/lib/warehouses/roles.ts`
- Create: `src/lib/warehouses/validate.ts`
- Test: `src/lib/warehouses/validate.test.ts`

- [ ] **Step 1: Tạo `src/lib/warehouses/roles.ts`**
```ts
export const siteRoleLabel: Record<string, string> = {
  KEEPER: "Thủ kho",
  TECHNICIAN: "Cán bộ kỹ thuật",
  COMMANDER: "Chỉ huy trưởng",
  DEPUTY: "Chỉ huy phó",
};

export const SITE_ROLES = ["KEEPER", "TECHNICIAN", "COMMANDER", "DEPUTY"] as const;
export type SiteRoleInput = (typeof SITE_ROLES)[number];
```

- [ ] **Step 2: Viết test thất bại** — Create `src/lib/warehouses/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateWarehouseInput } from "./validate";

describe("validateWarehouseInput", () => {
  it("hop le voi du lieu day du", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "Cong trinh A", type: "PROJECT", status: "ACTIVE" }).ok).toBe(true);
  });
  it("bao loi khi thieu ma kho", () => {
    expect(validateWarehouseInput({ code: " ", name: "A", type: "PROJECT", status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi thieu ten", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "", type: "PROJECT", status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi type khong hop le", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "A", type: "X" as never, status: "ACTIVE" }).ok).toBe(false);
  });
  it("bao loi khi status khong hop le", () => {
    expect(validateWarehouseInput({ code: "CT01", name: "A", type: "PROJECT", status: "X" as never }).ok).toBe(false);
  });
  it("chap nhan type CENTRAL va status CLOSED", () => {
    expect(validateWarehouseInput({ code: "KT", name: "Kho tong", type: "CENTRAL", status: "CLOSED" }).ok).toBe(true);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận FAIL** — `npx vitest run src/lib/warehouses/validate.test.ts`.

- [ ] **Step 4: Viết implementation** — Create `src/lib/warehouses/validate.ts`:
```ts
export type WarehouseTypeInput = "PROJECT" | "CENTRAL";
export type WarehouseStatusInput = "ACTIVE" | "CLOSED";

export interface WarehouseInput {
  code: string;
  name: string;
  type: WarehouseTypeInput;
  status: WarehouseStatusInput;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

const TYPES = ["PROJECT", "CENTRAL"];
const STATUSES = ["ACTIVE", "CLOSED"];

export function validateWarehouseInput(input: WarehouseInput): ValidateResult {
  if (!input.code || !input.code.trim()) {
    return { ok: false, error: "Vui lòng nhập mã công trình/kho" };
  }
  if (!input.name || !input.name.trim()) {
    return { ok: false, error: "Vui lòng nhập tên công trình" };
  }
  if (!TYPES.includes(input.type)) {
    return { ok: false, error: "Loại kho không hợp lệ" };
  }
  if (!STATUSES.includes(input.status)) {
    return { ok: false, error: "Trạng thái không hợp lệ" };
  }
  return { ok: true };
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS** (6 tests).

- [ ] **Step 6: Commit**
```
git add -A
git commit -m "feat: nhan vai tro + validate cong trinh/kho (TDD)"
```

---

## Task 3: Server actions tạo/sửa công trình

**Files:**
- Create: `src/lib/warehouses/actions.ts`

- [ ] **Step 1: Tạo `src/lib/warehouses/actions.ts`**
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import {
  validateWarehouseInput,
  type WarehouseTypeInput,
  type WarehouseStatusInput,
} from "./validate";

export interface WarehouseFormState {
  error?: string;
}

function readType(formData: FormData): WarehouseTypeInput {
  return String(formData.get("type") ?? "") === "CENTRAL" ? "CENTRAL" : "PROJECT";
}
function readStatus(formData: FormData): WarehouseStatusInput {
  return String(formData.get("status") ?? "") === "CLOSED" ? "CLOSED" : "ACTIVE";
}

export async function createWarehouseAction(
  _prev: WarehouseFormState,
  formData: FormData,
): Promise<WarehouseFormState> {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const type = readType(formData);
  const status = readStatus(formData);

  const v = validateWarehouseInput({ code, name, type, status });
  if (!v.ok) return { error: v.error };

  try {
    await db.warehouse.create({
      data: { code, name, address: address || null, type, status },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Mã công trình/kho đã tồn tại" };
    }
    throw e;
  }

  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export async function updateWarehouseAction(
  _prev: WarehouseFormState,
  formData: FormData,
): Promise<WarehouseFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const type = readType(formData);
  const status = readStatus(formData);

  const target = await db.warehouse.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy công trình" };

  // code không sửa; validate phần còn lại
  const v = validateWarehouseInput({ code: target.code, name, type, status });
  if (!v.ok) return { error: v.error };

  await db.warehouse.update({
    where: { id },
    data: { name, address: address || null, type, status },
  });

  revalidatePath("/warehouses");
  redirect("/warehouses");
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (không lỗi). `redirect()` để ngoài try/catch.

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: server actions tao/sua cong trinh"
```

---

## Task 4: Server actions phân công nhân sự

**Files:**
- Create: `src/lib/warehouses/assignments.ts`

- [ ] **Step 1: Tạo `src/lib/warehouses/assignments.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { SITE_ROLES, type SiteRoleInput } from "./roles";

export interface AssignmentFormState {
  error?: string;
}

function readSiteRole(formData: FormData): SiteRoleInput | null {
  const raw = String(formData.get("siteRole") ?? "");
  return (SITE_ROLES as readonly string[]).includes(raw) ? (raw as SiteRoleInput) : null;
}

export async function assignUserAction(
  _prev: AssignmentFormState,
  formData: FormData,
): Promise<AssignmentFormState> {
  await requireAdmin();

  const warehouseId = String(formData.get("warehouseId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const siteRole = readSiteRole(formData);

  if (!warehouseId || !userId || !siteRole) {
    return { error: "Vui lòng chọn người dùng và vai trò" };
  }

  try {
    await db.assignment.create({ data: { warehouseId, userId, siteRole } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Người này đã có vai trò này tại công trình" };
    }
    throw e;
  }

  revalidatePath(`/warehouses/${warehouseId}`);
  return {};
}

export async function removeAssignmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const warehouseId = String(formData.get("warehouseId") ?? "");
  if (id) await db.assignment.delete({ where: { id } });
  revalidatePath(`/warehouses/${warehouseId}`);
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` (không lỗi).

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: server actions phan cong/go phan cong"
```

---

## Task 5: Link "Công trình" trên thanh điều hướng

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Thêm link vào `<nav>`** trong `src/app/(app)/layout.tsx` — ngay sau link "Người dùng" (cùng điều kiện `isAdmin`):
```tsx
            {isAdmin && (
              <Link href="/warehouses" className="text-gray-700 hover:text-blue-600">Công trình</Link>
            )}
```
(Đặt block này liền sau block link `/users` đã có.)

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: them link Cong trinh tren nav"
```

---

## Task 6: Trang danh sách công trình

**Files:**
- Create: `src/app/(app)/warehouses/page.tsx`

- [ ] **Step 1: Tạo `src/app/(app)/warehouses/page.tsx`**
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

const typeLabel: Record<string, string> = { PROJECT: "Công trình", CENTRAL: "Kho tổng" };

export default async function WarehousesPage() {
  await requireAdmin();
  const warehouses = await db.warehouse.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Công trình / Kho</h1>
        <Link href="/warehouses/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
          + Thêm công trình
        </Link>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Nhân sự</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="px-3 py-2 font-mono">{w.code}</td>
                <td className="px-3 py-2">{w.name}</td>
                <td className="px-3 py-2">{typeLabel[w.type]}</td>
                <td className="px-3 py-2">{w._count.assignments}</td>
                <td className="px-3 py-2">
                  {w.status === "ACTIVE"
                    ? <span className="text-green-600">Đang hoạt động</span>
                    : <span className="text-gray-400">Đã đóng</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/warehouses/${w.id}`} className="text-blue-600 hover:underline">Sửa / Phân công</Link>
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

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 3: Commit**
```
git add -A
git commit -m "feat: trang danh sach cong trinh"
```

---

## Task 7: Trang tạo công trình

**Files:**
- Create: `src/app/(app)/warehouses/new/page.tsx`
- Create: `src/app/(app)/warehouses/new/form.tsx`

- [ ] **Step 1: Tạo `src/app/(app)/warehouses/new/page.tsx`**
```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { WarehouseCreateForm } from "./form";

export default async function NewWarehousePage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Thêm công trình / kho</h1>
      <WarehouseCreateForm />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/app/(app)/warehouses/new/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createWarehouseAction, type WarehouseFormState } from "@/lib/warehouses/actions";

const initial: WarehouseFormState = {};

export function WarehouseCreateForm() {
  const [state, action, pending] = useActionState(createWarehouseAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="code">Mã công trình/kho</label>
        <input id="code" name="code" required autoComplete="off" className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên công trình</label>
        <input id="name" name="name" required className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="type">Loại</label>
        <select id="type" name="type" defaultValue="PROJECT" className="w-full border rounded-lg px-3 py-2">
          <option value="PROJECT">Công trình</option>
          <option value="CENTRAL">Kho tổng</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="address">Địa chỉ (tùy chọn)</label>
        <input id="address" name="address" className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/warehouses" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 4: Commit**
```
git add -A
git commit -m "feat: trang tao cong trinh"
```

---

## Task 8: Trang sửa công trình + quản lý phân công

**Files:**
- Create: `src/app/(app)/warehouses/[id]/page.tsx`
- Create: `src/app/(app)/warehouses/[id]/form.tsx`
- Create: `src/app/(app)/warehouses/[id]/assignments.tsx`

- [ ] **Step 1: Tạo trang `src/app/(app)/warehouses/[id]/page.tsx`**
```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { WarehouseEditForm } from "./form";
import { AssignmentsManager } from "./assignments";

export default async function EditWarehousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const warehouse = await db.warehouse.findUnique({
    where: { id },
    include: {
      assignments: { include: { user: true }, orderBy: { siteRole: "asc" } },
    },
  });
  if (!warehouse) notFound();

  const activeUsers = await db.user.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, username: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold">Sửa công trình: {warehouse.name}</h1>

      <WarehouseEditForm
        warehouse={{
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          type: warehouse.type,
          address: warehouse.address,
          status: warehouse.status,
        }}
      />

      <AssignmentsManager
        warehouseId={warehouse.id}
        users={activeUsers}
        assignments={warehouse.assignments.map((a) => ({
          id: a.id,
          siteRole: a.siteRole,
          userFullName: a.user.fullName,
          username: a.user.username,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/app/(app)/warehouses/[id]/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateWarehouseAction, type WarehouseFormState } from "@/lib/warehouses/actions";

interface Props {
  warehouse: {
    id: string;
    code: string;
    name: string;
    type: "PROJECT" | "CENTRAL";
    address: string | null;
    status: "ACTIVE" | "CLOSED";
  };
}

const initial: WarehouseFormState = {};

export function WarehouseEditForm({ warehouse }: Props) {
  const [state, action, pending] = useActionState(updateWarehouseAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={warehouse.id} />
      <div className="space-y-1">
        <label className="text-sm font-medium">Mã công trình/kho</label>
        <input value={warehouse.code} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 font-mono" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên công trình</label>
        <input id="name" name="name" required defaultValue={warehouse.name} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="type">Loại</label>
        <select id="type" name="type" defaultValue={warehouse.type} className="w-full border rounded-lg px-3 py-2">
          <option value="PROJECT">Công trình</option>
          <option value="CENTRAL">Kho tổng</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="address">Địa chỉ (tùy chọn)</label>
        <input id="address" name="address" defaultValue={warehouse.address ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="status">Trạng thái</label>
        <select id="status" name="status" defaultValue={warehouse.status} className="w-full border rounded-lg px-3 py-2">
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/warehouses" className="px-4 py-2 text-sm text-gray-600">Quay lại</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Tạo `src/app/(app)/warehouses/[id]/assignments.tsx`**
```tsx
"use client";

import { useActionState } from "react";
import { assignUserAction, removeAssignmentAction, type AssignmentFormState } from "@/lib/warehouses/assignments";
import { siteRoleLabel, SITE_ROLES } from "@/lib/warehouses/roles";

interface AssignmentRow {
  id: string;
  siteRole: string;
  userFullName: string;
  username: string;
}
interface Props {
  warehouseId: string;
  users: { id: string; fullName: string; username: string }[];
  assignments: AssignmentRow[];
}

const initial: AssignmentFormState = {};

export function AssignmentsManager({ warehouseId, users, assignments }: Props) {
  const [state, action, pending] = useActionState(assignUserAction, initial);

  return (
    <section className="bg-white rounded-xl shadow p-6 space-y-4">
      <h2 className="font-semibold">Nhân sự phụ trách</h2>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có ai được phân công.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr><th className="py-1">Họ tên</th><th className="py-1">Tài khoản</th><th className="py-1">Vai trò</th><th></th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2">{a.userFullName}</td>
                <td className="py-2">{a.username}</td>
                <td className="py-2">{siteRoleLabel[a.siteRole]}</td>
                <td className="py-2 text-right">
                  <form action={removeAssignmentAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="warehouseId" value={warehouseId} />
                    <button type="submit" className="text-red-600 hover:underline">Gỡ</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-4">
        <input type="hidden" name="warehouseId" value={warehouseId} />
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="userId">Người dùng</label>
          <select id="userId" name="userId" required className="border rounded-lg px-3 py-2 text-sm">
            <option value="">— Chọn —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="siteRole">Vai trò</label>
          <select id="siteRole" name="siteRole" required className="border rounded-lg px-3 py-2 text-sm">
            <option value="">— Chọn —</option>
            {SITE_ROLES.map((r) => (
              <option key={r} value={r}>{siteRoleLabel[r]}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang thêm..." : "Phân công"}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Type-check + build** — `npx tsc --noEmit` rồi `npm run build` (routes `/warehouses`, `/warehouses/new`, `/warehouses/[id]` xuất hiện, không lỗi). Paste route summary.

- [ ] **Step 5: Commit**
```
git add -A
git commit -m "feat: trang sua cong trinh + quan ly phan cong"
```

---

## Task 9: Kiểm thử end-to-end + toàn bộ test

- [ ] **Step 1: Chạy toàn bộ unit test** — `npm test` → tất cả PASS (15 cũ + validateWarehouseInput 6 = 21).

- [ ] **Step 2:** `npm run dev`, đăng nhập `admin`/`admin123`.

- [ ] **Step 3: Kiểm thử luồng:**
  - Menu hiện link **"Công trình"** → `/warehouses` (rỗng lúc đầu).
  - **Thêm công trình**: tạo "CT01 / Công trình Tòa nhà A" → hiện trong danh sách (cột Nhân sự = 0).
  - Tạo trùng mã `CT01` → báo "Mã công trình/kho đã tồn tại". Tạo thiếu tên → báo lỗi.
  - **Sửa / Phân công**: mở CT01. Đổi tên/địa chỉ/trạng thái → Lưu OK. Mã hiển thị mờ (không sửa được).
  - **Phân công**: chọn 1 user + vai trò "Thủ kho" → bấm Phân công → xuất hiện trong bảng "Nhân sự phụ trách"; cột Nhân sự ở danh sách tăng lên 1.
  - Phân công lại **đúng người + đúng vai trò** đó → báo "Người này đã có vai trò này tại công trình". Thêm **vai trò khác** cho cùng người → OK.
  - Bấm **Gỡ** một dòng → biến mất.
  - Đăng nhập user không phải ADMIN → không thấy link "Công trình"; gõ `/warehouses` → bị đẩy về trang tổng quan.

- [ ] **Step 4:** Báo kết quả.

---

## Hoàn thành Kế hoạch 2b
Quản lý công trình/kho và phân công nhân sự đầy đủ. Cùng 2a, toàn bộ **danh mục người dùng + kho** đã xong. Còn lại **Kế hoạch 2c** (Vật tư + import Excel) để hoàn tất "Danh mục dữ liệu".

**Out of scope (kế hoạch sau):** CRUD vật tư + import Excel (2c); mọi nghiệp vụ phiếu/tồn kho (KH3+). Chưa kiểm tra ràng buộc "đóng kho khi còn tồn" vì tồn kho chưa tồn tại.
