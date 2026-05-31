# Kế hoạch 2c — Danh mục vật tư + Import Excel (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho Quản lý (ADMIN) tạo/sửa/vô hiệu hóa vật tư và nhập danh mục vật tư hàng loạt từ file Excel.

**Architecture:** Tiếp nối 2a/2b. Thêm model `Material`. Validation vật tư tách thuần (TDD). Logic phân tích dữ liệu Excel cũng tách thành **hàm thuần** `parseMaterialRows` (TDD) — server action chỉ lo đọc file (exceljs) rồi gọi hàm thuần và upsert. Mọi action/trang bảo vệ bằng `requireAdmin()`.

**Tech Stack:** Next.js 16 (App Router, server actions) · TypeScript · Prisma v7 · `exceljs` (đọc .xlsx) · Vitest.

> **Spec nguồn:** `docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md` (mục 3.4 `Material`, mục 4 phân quyền, mục 7 import danh mục). Nối tiếp 2a/2b (`requireAdmin`, `db`, nav khu quản trị, mẫu CRUD).

---

## Quyết định thiết kế (đã chốt)
- Chỉ **ADMIN** truy cập khu `/materials`.
- `code` (mã vật tư/SKU) đặt lúc tạo, **không sửa** sau. Sửa được các trường còn lại + vô hiệu hóa.
- "Xóa" = `isActive = false`. Không xóa cứng.
- `latestUnitPrice` (đơn giá tham khảo, VND) **tùy chọn**, ≥ 0; lưu kiểu `Decimal?`. Khi truyền sang client component phải đổi sang **string** (Decimal không serialize được).
- **Import Excel:** đọc sheet đầu tiên, cột theo header tiếng Việt cố định (xem Task 7). Upsert theo `code` (mã mới → tạo, mã đã có → cập nhật các trường). Báo cáo: số tạo / cập nhật / số dòng lỗi (kèm lý do).

## File Structure (Kế hoạch 2c)

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` (sửa) | Thêm model `Material` |
| `src/lib/materials/validate.ts` (+ `.test.ts`) | `validateMaterialInput()` thuần (TDD) |
| `src/lib/materials/import-parse.ts` (+ `.test.ts`) | `parseMaterialRows()` thuần (TDD) |
| `src/lib/materials/actions.ts` | `createMaterialAction`, `updateMaterialAction` |
| `src/lib/materials/import-actions.ts` | `importMaterialsAction` (đọc file exceljs + upsert) |
| `src/app/(app)/layout.tsx` (sửa) | Thêm link "Vật tư" (admin) |
| `src/app/(app)/materials/page.tsx` | Danh sách vật tư |
| `src/app/(app)/materials/new/page.tsx` + `form.tsx` | Tạo vật tư |
| `src/app/(app)/materials/[id]/page.tsx` + `form.tsx` | Sửa vật tư |
| `src/app/(app)/materials/import/page.tsx` + `form.tsx` | Import Excel |

---

## Task 1: Model Material + migration

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Thêm model vào `prisma/schema.prisma`**
```prisma
model Material {
  id              String   @id @default(uuid())
  code            String   @unique
  categoryName    String?
  name            String
  unit            String
  modelCode       String?
  brandOrigin     String?
  specification   String?
  latestUnitPrice Decimal?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}
```

- [ ] **Step 2: Migration** — `npx prisma migrate dev --name add_material`. Sau đó chạy `npx prisma generate` (đảm bảo client có `db.material`).

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 4: Commit** `feat: model Material + migration` (kèm trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

## Task 2: Validation vật tư (TDD)

**Files:** Create `src/lib/materials/validate.ts` (+ `.test.ts`)

- [ ] **Step 1: Viết test thất bại** — `src/lib/materials/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateMaterialInput } from "./validate";

const base = { code: "VT01", name: "Ong thep", unit: "m", price: 1000 as number | null };

describe("validateMaterialInput", () => {
  it("hop le voi du lieu day du", () => {
    expect(validateMaterialInput(base).ok).toBe(true);
  });
  it("hop le khi gia null", () => {
    expect(validateMaterialInput({ ...base, price: null }).ok).toBe(true);
  });
  it("loi khi thieu ma", () => {
    expect(validateMaterialInput({ ...base, code: " " }).ok).toBe(false);
  });
  it("loi khi thieu ten", () => {
    expect(validateMaterialInput({ ...base, name: "" }).ok).toBe(false);
  });
  it("loi khi thieu don vi", () => {
    expect(validateMaterialInput({ ...base, unit: "" }).ok).toBe(false);
  });
  it("loi khi gia am", () => {
    expect(validateMaterialInput({ ...base, price: -5 }).ok).toBe(false);
  });
  it("loi khi gia khong phai so", () => {
    expect(validateMaterialInput({ ...base, price: NaN }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test → FAIL.**

- [ ] **Step 3: Implementation** — `src/lib/materials/validate.ts`:
```ts
export interface MaterialInput {
  code: string;
  name: string;
  unit: string;
  price: number | null;
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateMaterialInput(input: MaterialInput): ValidateResult {
  if (!input.code || !input.code.trim()) return { ok: false, error: "Vui lòng nhập mã vật tư" };
  if (!input.name || !input.name.trim()) return { ok: false, error: "Vui lòng nhập tên vật tư" };
  if (!input.unit || !input.unit.trim()) return { ok: false, error: "Vui lòng nhập đơn vị tính" };
  if (input.price !== null) {
    if (!Number.isFinite(input.price) || input.price < 0) {
      return { ok: false, error: "Đơn giá không hợp lệ" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test → PASS (7).**

- [ ] **Step 5: Commit** `feat: validate vat tu (TDD)`

---

## Task 3: Server actions tạo/sửa vật tư

**Files:** Create `src/lib/materials/actions.ts`

- [ ] **Step 1: Tạo `src/lib/materials/actions.ts`**
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { validateMaterialInput } from "./validate";

export interface MaterialFormState {
  error?: string;
}

function readPrice(formData: FormData): number | null {
  const raw = String(formData.get("latestUnitPrice") ?? "").trim();
  return raw === "" ? null : Number(raw);
}
function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createMaterialAction(
  _prev: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireAdmin();

  const code = s(formData, "code");
  const name = s(formData, "name");
  const unit = s(formData, "unit");
  const price = readPrice(formData);

  const v = validateMaterialInput({ code, name, unit, price });
  if (!v.ok) return { error: v.error };

  try {
    await db.material.create({
      data: {
        code,
        name,
        unit,
        categoryName: s(formData, "categoryName") || null,
        modelCode: s(formData, "modelCode") || null,
        brandOrigin: s(formData, "brandOrigin") || null,
        specification: s(formData, "specification") || null,
        latestUnitPrice: price,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Mã vật tư đã tồn tại" };
    }
    throw e;
  }

  revalidatePath("/materials");
  redirect("/materials");
}

export async function updateMaterialAction(
  _prev: MaterialFormState,
  formData: FormData,
): Promise<MaterialFormState> {
  await requireAdmin();

  const id = s(formData, "id");
  const name = s(formData, "name");
  const unit = s(formData, "unit");
  const price = readPrice(formData);
  const isActive = formData.get("isActive") === "on";

  const target = await db.material.findUnique({ where: { id } });
  if (!target) return { error: "Không tìm thấy vật tư" };

  const v = validateMaterialInput({ code: target.code, name, unit, price });
  if (!v.ok) return { error: v.error };

  await db.material.update({
    where: { id },
    data: {
      name,
      unit,
      categoryName: s(formData, "categoryName") || null,
      modelCode: s(formData, "modelCode") || null,
      brandOrigin: s(formData, "brandOrigin") || null,
      specification: s(formData, "specification") || null,
      latestUnitPrice: price,
      isActive,
    },
  });

  revalidatePath("/materials");
  redirect("/materials");
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit`.

- [ ] **Step 3: Commit** `feat: server actions tao/sua vat tu`

---

## Task 4: Link "Vật tư" + trang danh sách vật tư

**Files:** Modify `src/app/(app)/layout.tsx`; Create `src/app/(app)/materials/page.tsx`

- [ ] **Step 1: Thêm link vào `<nav>`** (sau link "Công trình", cùng điều kiện `isAdmin`):
```tsx
            {isAdmin && (
              <Link href="/materials" className="text-gray-700 hover:text-blue-600">Vật tư</Link>
            )}
```

- [ ] **Step 2: Tạo `src/app/(app)/materials/page.tsx`**
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export default async function MaterialsPage() {
  await requireAdmin();
  const materials = await db.material.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Danh mục vật tư</h1>
        <div className="flex gap-2">
          <Link href="/materials/import" className="border rounded-lg px-3 py-2 text-sm">Nhập từ Excel</Link>
          <Link href="/materials/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Thêm vật tư</Link>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Nhóm</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-mono">{m.code}</td>
                <td className="px-3 py-2">{m.name}</td>
                <td className="px-3 py-2">{m.categoryName ?? "—"}</td>
                <td className="px-3 py-2">{m.unit}</td>
                <td className="px-3 py-2 text-right">
                  {m.latestUnitPrice != null ? Number(m.latestUnitPrice).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-2">
                  {m.isActive ? <span className="text-green-600">Đang dùng</span> : <span className="text-gray-400">Đã ẩn</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/materials/${m.id}`} className="text-blue-600 hover:underline">Sửa</Link>
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

- [ ] **Step 3: Type-check + Commit** `feat: link Vat tu + trang danh sach vat tu`

---

## Task 5: Trang tạo vật tư

**Files:** Create `src/app/(app)/materials/new/page.tsx` + `form.tsx`

- [ ] **Step 1: `new/page.tsx`**
```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { MaterialCreateForm } from "./form";

export default async function NewMaterialPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Thêm vật tư</h1>
      <MaterialCreateForm />
    </div>
  );
}
```

- [ ] **Step 2: `new/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMaterialAction, type MaterialFormState } from "@/lib/materials/actions";

const initial: MaterialFormState = {};

function Field({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <input id={id} name={id} required={required} className="w-full border rounded-lg px-3 py-2" />
    </div>
  );
}

export function MaterialCreateForm() {
  const [state, action, pending] = useActionState(createMaterialAction, initial);

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <Field id="code" label="Mã vật tư" required />
      <Field id="name" label="Tên vật tư" required />
      <Field id="unit" label="Đơn vị tính" required />
      <Field id="categoryName" label="Nhóm vật tư (tùy chọn)" />
      <Field id="modelCode" label="Mã hiệu (tùy chọn)" />
      <Field id="brandOrigin" label="Nhãn hiệu / Xuất xứ (tùy chọn)" />
      <Field id="specification" label="Thông số kỹ thuật (tùy chọn)" />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="latestUnitPrice">Đơn giá tham khảo - VND (tùy chọn)</label>
        <input id="latestUnitPrice" name="latestUnitPrice" type="number" min="0" step="any" className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/materials" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check + Commit** `feat: trang tao vat tu`

---

## Task 6: Trang sửa vật tư

**Files:** Create `src/app/(app)/materials/[id]/page.tsx` + `form.tsx`

- [ ] **Step 1: `[id]/page.tsx`** (đổi Decimal → string trước khi truyền sang client)
```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MaterialEditForm } from "./form";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const m = await db.material.findUnique({ where: { id } });
  if (!m) notFound();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Sửa vật tư</h1>
      <MaterialEditForm
        material={{
          id: m.id,
          code: m.code,
          name: m.name,
          unit: m.unit,
          categoryName: m.categoryName ?? "",
          modelCode: m.modelCode ?? "",
          brandOrigin: m.brandOrigin ?? "",
          specification: m.specification ?? "",
          price: m.latestUnitPrice != null ? String(m.latestUnitPrice) : "",
          isActive: m.isActive,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: `[id]/form.tsx`**
```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateMaterialAction, type MaterialFormState } from "@/lib/materials/actions";

interface Props {
  material: {
    id: string; code: string; name: string; unit: string;
    categoryName: string; modelCode: string; brandOrigin: string;
    specification: string; price: string; isActive: boolean;
  };
}

const initial: MaterialFormState = {};

export function MaterialEditForm({ material }: Props) {
  const [state, action, pending] = useActionState(updateMaterialAction, initial);
  const m = material;

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="id" value={m.id} />
      <div className="space-y-1">
        <label className="text-sm font-medium">Mã vật tư</label>
        <input value={m.code} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 font-mono" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Tên vật tư</label>
        <input id="name" name="name" required defaultValue={m.name} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="unit">Đơn vị tính</label>
        <input id="unit" name="unit" required defaultValue={m.unit} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="categoryName">Nhóm vật tư</label>
        <input id="categoryName" name="categoryName" defaultValue={m.categoryName} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="modelCode">Mã hiệu</label>
        <input id="modelCode" name="modelCode" defaultValue={m.modelCode} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="brandOrigin">Nhãn hiệu / Xuất xứ</label>
        <input id="brandOrigin" name="brandOrigin" defaultValue={m.brandOrigin} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="specification">Thông số kỹ thuật</label>
        <input id="specification" name="specification" defaultValue={m.specification} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="latestUnitPrice">Đơn giá tham khảo - VND</label>
        <input id="latestUnitPrice" name="latestUnitPrice" type="number" min="0" step="any" defaultValue={m.price} className="w-full border rounded-lg px-3 py-2" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={m.isActive} />
        Đang dùng
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <Link href="/materials" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check + Commit** `feat: trang sua vat tu`

---

## Task 7: Hàm phân tích Excel (TDD) + cài exceljs

**Files:** Create `src/lib/materials/import-parse.ts` (+ `.test.ts`)

> Hàm thuần nhận mảng các dòng đã đọc từ Excel (mỗi dòng là object keyed theo tên cột tiếng Việt), validate + map sang dữ liệu vật tư. **Cột mong đợi:** `Mã` (bắt buộc), `Tên` (bắt buộc), `Đơn vị` (bắt buộc), `Nhóm`, `Mã hiệu`, `Nhãn hiệu`, `Thông số`, `Đơn giá`.

- [ ] **Step 1: Cài exceljs** — `npm install exceljs`

- [ ] **Step 2: Viết test thất bại** — `src/lib/materials/import-parse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseMaterialRows } from "./import-parse";

describe("parseMaterialRows", () => {
  it("phan tich dong hop le day du", () => {
    const r = parseMaterialRows([
      { "Mã": "VT01", "Tên": "Ong thep D100", "Đơn vị": "m", "Nhóm": "Ong", "Mã hiệu": "D100", "Nhãn hiệu": "Hoa Phat", "Thông số": "DN100", "Đơn giá": 150000 },
    ]);
    expect(r.errors).toHaveLength(0);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      code: "VT01", name: "Ong thep D100", unit: "m", categoryName: "Ong",
      modelCode: "D100", brandOrigin: "Hoa Phat", specification: "DN100", latestUnitPrice: 150000,
    });
  });
  it("don gia trong -> null", () => {
    const r = parseMaterialRows([{ "Mã": "VT02", "Tên": "X", "Đơn vị": "cai", "Đơn giá": "" }]);
    expect(r.items[0].latestUnitPrice).toBeNull();
  });
  it("don gia dang chuoi van parse duoc", () => {
    const r = parseMaterialRows([{ "Mã": "VT03", "Tên": "X", "Đơn vị": "cai", "Đơn giá": "2000" }]);
    expect(r.items[0].latestUnitPrice).toBe(2000);
  });
  it("dong thieu ma -> loi, khong vao items", () => {
    const r = parseMaterialRows([{ "Mã": "", "Tên": "X", "Đơn vị": "cai" }]);
    expect(r.items).toHaveLength(0);
    expect(r.errors[0].line).toBe(2); // dong 1 la header
  });
  it("don gia am -> loi", () => {
    const r = parseMaterialRows([{ "Mã": "VT04", "Tên": "X", "Đơn vị": "cai", "Đơn giá": -1 }]);
    expect(r.errors).toHaveLength(1);
    expect(r.items).toHaveLength(0);
  });
  it("nhieu dong: tron hop le va loi", () => {
    const r = parseMaterialRows([
      { "Mã": "A", "Tên": "Ten A", "Đơn vị": "m" },
      { "Mã": "", "Tên": "Ten B", "Đơn vị": "m" },
    ]);
    expect(r.items).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Chạy test → FAIL.**

- [ ] **Step 4: Implementation** — `src/lib/materials/import-parse.ts`:
```ts
import { validateMaterialInput } from "./validate";

export interface ParsedMaterial {
  code: string;
  name: string;
  unit: string;
  categoryName: string | null;
  modelCode: string | null;
  brandOrigin: string | null;
  specification: string | null;
  latestUnitPrice: number | null;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  items: ParsedMaterial[];
  errors: ParseError[];
}

type RawRow = Record<string, unknown>;

function str(row: RawRow, key: string): string {
  const v = row[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

function optional(row: RawRow, key: string): string | null {
  const v = str(row, key);
  return v === "" ? null : v;
}

function toPrice(row: RawRow): number | null {
  const raw = str(row, "Đơn giá");
  return raw === "" ? null : Number(raw);
}

export function parseMaterialRows(rows: RawRow[]): ParseResult {
  const items: ParsedMaterial[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // dòng 1 là header
    const code = str(row, "Mã");
    const name = str(row, "Tên");
    const unit = str(row, "Đơn vị");
    const price = toPrice(row);

    const v = validateMaterialInput({ code, name, unit, price });
    if (!v.ok) {
      errors.push({ line, message: v.error });
      return;
    }

    items.push({
      code,
      name,
      unit,
      categoryName: optional(row, "Nhóm"),
      modelCode: optional(row, "Mã hiệu"),
      brandOrigin: optional(row, "Nhãn hiệu"),
      specification: optional(row, "Thông số"),
      latestUnitPrice: price,
    });
  });

  return { items, errors };
}
```

- [ ] **Step 5: Chạy test → PASS (6).**

- [ ] **Step 6: Commit** `feat: ham phan tich Excel vat tu (TDD) + exceljs`

---

## Task 8: Server action import + trang import

**Files:** Create `src/lib/materials/import-actions.ts`, `src/app/(app)/materials/import/page.tsx`, `src/app/(app)/materials/import/form.tsx`

- [ ] **Step 1: Tạo `src/lib/materials/import-actions.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { parseMaterialRows } from "./import-parse";

export interface ImportState {
  error?: string;
  summary?: { created: number; updated: number; errors: { line: number; message: string }[] };
}

export async function importMaterialsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vui lòng chọn file Excel (.xlsx)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: "Không đọc được file. Hãy dùng định dạng .xlsx" };
  }

  const ws = wb.worksheets[0];
  if (!ws) return { error: "File không có sheet nào" };

  // Đọc header (dòng 1) rồi map từng dòng thành object keyed theo tên cột
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = cell.text.trim(); // .text làm phẳng rich-text/công thức
  });

  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cell.value;
      // Ô rich-text/công thức/hyperlink trả về object → dùng .text (đã làm phẳng).
      // Số/chuỗi/ngày giữ nguyên giá trị thô (để parse đơn giá số đúng, tránh dấu phân cách).
      obj[key] = v !== null && typeof v === "object" && !(v instanceof Date) ? cell.text : v;
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });

  const { items, errors } = parseMaterialRows(rows);

  let created = 0;
  let updated = 0;
  for (const it of items) {
    const existing = await db.material.findUnique({ where: { code: it.code } });
    await db.material.upsert({
      where: { code: it.code },
      create: {
        code: it.code, name: it.name, unit: it.unit,
        categoryName: it.categoryName, modelCode: it.modelCode,
        brandOrigin: it.brandOrigin, specification: it.specification,
        latestUnitPrice: it.latestUnitPrice,
      },
      update: {
        name: it.name, unit: it.unit,
        categoryName: it.categoryName, modelCode: it.modelCode,
        brandOrigin: it.brandOrigin, specification: it.specification,
        latestUnitPrice: it.latestUnitPrice,
      },
    });
    if (existing) updated++;
    else created++;
  }

  revalidatePath("/materials");
  return { summary: { created, updated, errors } };
}
```

- [ ] **Step 2: Tạo `src/app/(app)/materials/import/page.tsx`**
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { ImportForm } from "./form";

export default async function ImportMaterialsPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Nhập vật tư từ Excel</h1>
      <div className="bg-white rounded-xl shadow p-6 space-y-3 text-sm text-gray-600">
        <p>File <b>.xlsx</b>, dòng đầu là tiêu đề cột. Các cột:</p>
        <p className="font-mono text-xs">Mã | Tên | Đơn vị | Nhóm | Mã hiệu | Nhãn hiệu | Thông số | Đơn giá</p>
        <p>Bắt buộc: <b>Mã, Tên, Đơn vị</b>. Mã đã có sẽ được cập nhật; mã mới sẽ được tạo.</p>
      </div>
      <ImportForm />
      <Link href="/materials" className="inline-block text-sm text-gray-600">← Về danh sách</Link>
    </div>
  );
}
```

- [ ] **Step 3: Tạo `src/app/(app)/materials/import/form.tsx`**
```tsx
"use client";

import { useActionState } from "react";
import { importMaterialsAction, type ImportState } from "@/lib/materials/import-actions";

const initial: ImportState = {};

export function ImportForm() {
  const [state, action, pending] = useActionState(importMaterialsAction, initial);

  return (
    <div className="space-y-4">
      <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
        <input type="file" name="file" accept=".xlsx" required className="block w-full text-sm" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang nhập..." : "Tải lên & nhập"}
        </button>
      </form>

      {state.summary && (
        <div className="bg-white rounded-xl shadow p-6 space-y-2 text-sm">
          <p className="text-green-700">Tạo mới: {state.summary.created} · Cập nhật: {state.summary.updated} · Lỗi: {state.summary.errors.length}</p>
          {state.summary.errors.length > 0 && (
            <ul className="list-disc pl-5 text-red-600">
              {state.summary.errors.map((e, idx) => (
                <li key={idx}>Dòng {e.line}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check + build** — `npx tsc --noEmit` rồi `npm run build` (routes `/materials`, `/materials/new`, `/materials/[id]`, `/materials/import`). Paste route summary.

- [ ] **Step 5: Commit** `feat: import vat tu tu Excel (action + trang)`

---

## Task 9: Kiểm thử end-to-end + toàn bộ test

- [ ] **Step 1:** `npm test` → tất cả PASS (21 cũ + validateMaterialInput 7 + parseMaterialRows 6 = 34).

- [ ] **Step 2:** `npm run dev`, đăng nhập `admin`/`admin123`.

- [ ] **Step 3: Kiểm thử luồng:**
  - Menu có link **"Vật tư"** → `/materials` (rỗng lúc đầu).
  - **Thêm vật tư**: tạo "VT01 / Ống thép D100 / m / đơn giá 150000" → hiện trong danh sách (đơn giá hiển thị `150.000`).
  - Tạo trùng mã `VT01` → báo "Mã vật tư đã tồn tại". Bỏ trống Tên/Đơn vị → báo lỗi. Đơn giá âm → báo lỗi.
  - **Sửa**: đổi tên/đơn giá, bỏ tick "Đang dùng" → Lưu OK. Mã hiển thị mờ.
  - **Nhập từ Excel**: chuẩn bị 1 file .xlsx với các cột đúng (Mã, Tên, Đơn vị, ...). Tải lên → thấy báo cáo "Tạo mới: x · Cập nhật: y · Lỗi: z". Thử file có 1 dòng thiếu Mã → dòng đó vào danh sách lỗi (kèm số dòng), các dòng hợp lệ vẫn được nhập.
  - Đăng nhập user không phải ADMIN → không thấy link "Vật tư"; gõ `/materials` → bị đẩy về trang tổng quan.

- [ ] **Step 4:** Báo kết quả.

---

## Hoàn thành Kế hoạch 2c
Danh mục vật tư + import Excel xong. **Toàn bộ Kế hoạch 2 (Danh mục dữ liệu) hoàn tất** (người dùng + công trình/kho + vật tư). Sẵn sàng cho **Kế hoạch 3** (Lõi tồn kho + Nhập kho).

**Out of scope (kế hoạch sau):** mọi nghiệp vụ phiếu/tồn kho (KH3+); xuất danh mục ra Excel (chỉ import ở giai đoạn này); tải file mẫu Excel; tìm kiếm/lọc/phân trang danh sách vật tư (thêm sau nếu cần).
