# Kế hoạch 5 (KH5) — Điều chuyển kho & Kiểm kê/Điều chỉnh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 2 luồng phiếu mới — **Điều chuyển** (chuyển vật tư giữa 2 kho, duyệt là hoàn thành) và **Kiểm kê/Điều chỉnh** (đặt tồn = số đếm thực tế) — đúng quy trình 2 bước, atomic, không cho tồn âm.

**Architecture:** Bám đúng khuôn mẫu KH3/KH4: lõi thuần (TDD) → validate (TDD) → phân quyền (`can.ts`, TDD) → server actions (transaction + retry số phiếu + trừ tồn atomic) → trang UI server-component + form client `useActionState`. Schema **không đổi** (đã có `TRANSFER`/`ADJUSTMENT`, `targetWarehouseId`, `countedQty`). Số phiếu: Điều chuyển = `PDC-YYYY-NNNN`, Kiểm kê = `PKK-YYYY-NNNN`.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma v7 (`db.$transaction`, `Prisma.Decimal`, `updateMany ... where quantity>=`, `upsert`), Vitest, Tailwind v4.

---

## Bối cảnh & quyết định đã chốt

- **Điều chuyển (2 bước):** Cán bộ kỹ thuật (TECHNICIAN) kho nguồn / ADMIN lập (kho nguồn → kho đích, nhiều dòng) → `PENDING`. Chỉ huy trưởng/phó (COMMANDER/DEPUTY) **kho nguồn** / ADMIN, **≠ người lập**, duyệt → áp dụng ngay: **trừ kho nguồn, cộng kho đích**, ghi `Ledger` 2 dòng/vật tư → `COMPLETED`. Từ chối → `REJECTED`. PENDING sửa/hủy được bởi người lập/ADMIN.
- **Kiểm kê (2 bước):** Thủ kho (KEEPER) kho đó / ADMIN lập; màn hình **tự nạp toàn bộ vật tư đang có tồn** + cho **thêm dòng mới** → `PENDING`. Chỉ huy duyệt (≠ người lập) → **đặt tồn = số đếm**, ghi chênh lệch (đếm − tồn cũ) vào `Ledger`; vật tư chưa có tồn thì tạo dòng mới → `COMPLETED`. Từ chối → `REJECTED`.
- **Tái dùng (DRY):** site-guard `issuableWarehouses` (TECHNICIAN) cho dropdown nguồn điều chuyển; `receivableWarehouses` (KEEPER) cho dropdown kho kiểm kê. Helper dùng chung tách ra `src/lib/inventory/form-helpers.ts`.
- **Số phiếu:** sửa `src/lib/documents/code.ts`: `TRANSFER` `"PC"`→`"PDC"`, `ADJUSTMENT` `"KK"`→`"PKK"`.
- **Không cho tồn âm** chỉ áp ở bước trừ kho nguồn (điều chuyển). Kiểm kê đặt tồn tuyệt đối theo số đếm (số đếm ≥ 0), không có khái niệm "đủ tồn".

## File structure (tạo/sửa)

**Dùng chung:**
- Modify `src/lib/documents/code.ts` — đổi prefix TRANSFER/ADJUSTMENT.
- Create `src/lib/inventory/form-helpers.ts` — `parseLines`, `loadAssignments`, `assertMaterialsValid` (dùng cho 2 action mới).
- Modify `src/lib/auth/can.ts` — thêm quyền điều chuyển + kiểm kê + `canModifyPendingDoc` chung.
- Modify `src/app/(app)/layout.tsx` — thêm 2 link nav.

**Điều chuyển:**
- Create `src/lib/inventory/transfer-postings.ts` (+ `.test.ts`).
- Create `src/lib/inventory/validate-transfer.ts` (+ `.test.ts`).
- Create `src/lib/inventory/transfer-actions.ts`.
- Create `src/app/(app)/transfers/page.tsx`, `TransferForm.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`.

**Kiểm kê:**
- Create `src/lib/inventory/adjustment-postings.ts` (+ `.test.ts`).
- Create `src/lib/inventory/validate-adjustment.ts` (+ `.test.ts`).
- Create `src/lib/inventory/adjustment-actions.ts`.
- Create `src/app/(app)/stocktakes/page.tsx`, `StocktakeForm.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`.

---

## Task 1: Lõi tính biến động điều chuyển (transfer-postings)

**Files:**
- Create: `src/lib/inventory/transfer-postings.ts`
- Test: `src/lib/inventory/transfer-postings.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// src/lib/inventory/transfer-postings.test.ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeTransferPostings } from "./transfer-postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeTransferPostings", () => {
  it("du ton nguon -> tra moves duong theo vat tu", () => {
    const r = computeTransferPostings({ m1: D(10) }, [{ materialId: "m1", qty: 4 }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.moves).toHaveLength(1);
      expect(r.moves[0].materialId).toBe("m1");
      expect(r.moves[0].qty.toString()).toBe("4");
    }
  });

  it("gop nhieu dong cung vat tu", () => {
    const r = computeTransferPostings({ m1: D(10) }, [
      { materialId: "m1", qty: 3 },
      { materialId: "m1", qty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.moves[0].qty.toString()).toBe("5");
  });

  it("khong du ton nguon -> ok=false, liet ke thieu", () => {
    const r = computeTransferPostings({ m1: D(3) }, [{ materialId: "m1", qty: 5 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.insufficient[0].materialId).toBe("m1");
      expect(r.insufficient[0].available.toString()).toBe("3");
      expect(r.insufficient[0].needed.toString()).toBe("5");
    }
  });

  it("vat tu khong co ton nguon -> thieu (available 0)", () => {
    const r = computeTransferPostings({}, [{ materialId: "m9", qty: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.insufficient[0].available.toString()).toBe("0");
  });

  it("bo qua dong qty <= 0", () => {
    const r = computeTransferPostings({ m1: D(10) }, [
      { materialId: "m1", qty: 0 },
      { materialId: "m1", qty: 2 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.moves[0].qty.toString()).toBe("2");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- transfer-postings`
Expected: FAIL ("computeTransferPostings is not a function" / không import được).

- [ ] **Step 3: Cài đặt tối thiểu**

```typescript
// src/lib/inventory/transfer-postings.ts
import { Prisma } from "@prisma/client";

export interface TransferLine {
  materialId: string;
  qty: number;
}

export interface TransferMove {
  materialId: string;
  qty: Prisma.Decimal;
}

export interface TransferInsufficient {
  materialId: string;
  available: Prisma.Decimal;
  needed: Prisma.Decimal;
}

export type TransferResult =
  | { ok: true; moves: TransferMove[] }
  | { ok: false; insufficient: TransferInsufficient[] };

/**
 * Tính lượng chuyển cho từng vật tư (thuần). Gộp theo vật tư, kiểm tra đủ tồn kho nguồn.
 * Trả về danh sách `moves` (dương) để action trừ nguồn / cộng đích.
 */
export function computeTransferPostings(
  sourceQty: Record<string, Prisma.Decimal>,
  lines: TransferLine[],
): TransferResult {
  const totals = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    if (!(l.qty > 0)) continue;
    const prev = totals.get(l.materialId) ?? new Prisma.Decimal(0);
    totals.set(l.materialId, prev.plus(l.qty));
  }

  const insufficient: TransferInsufficient[] = [];
  const moves: TransferMove[] = [];
  for (const [materialId, needed] of totals) {
    const available = sourceQty[materialId] ?? new Prisma.Decimal(0);
    if (available.minus(needed).isNegative()) {
      insufficient.push({ materialId, available, needed });
    } else {
      moves.push({ materialId, qty: needed });
    }
  }

  if (insufficient.length > 0) return { ok: false, insufficient };
  return { ok: true, moves };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- transfer-postings`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/transfer-postings.ts src/lib/inventory/transfer-postings.test.ts
git commit -m "feat: loi tinh bien dong dieu chuyen (TDD)"
```

---

## Task 2: Validate đề nghị điều chuyển (validate-transfer)

**Files:**
- Create: `src/lib/inventory/validate-transfer.ts`
- Test: `src/lib/inventory/validate-transfer.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// src/lib/inventory/validate-transfer.test.ts
import { describe, it, expect } from "vitest";
import { validateTransferRequest } from "./validate-transfer";

const okLines = [{ materialId: "m1", qty: 2 }];

describe("validateTransferRequest", () => {
  it("thieu kho nguon -> loi", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "", targetWarehouseId: "b", lines: okLines });
    expect(r.ok).toBe(false);
  });

  it("thieu kho dich -> loi", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "", lines: okLines });
    expect(r.ok).toBe(false);
  });

  it("nguon trung dich -> loi", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "a", lines: okLines });
    expect(r.ok).toBe(false);
  });

  it("khong co dong -> loi", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: [] });
    expect(r.ok).toBe(false);
  });

  it("so luong <= 0 -> loi", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: [{ materialId: "m1", qty: 0 }] });
    expect(r.ok).toBe(false);
  });

  it("hop le -> ok", () => {
    const r = validateTransferRequest({ sourceWarehouseId: "a", targetWarehouseId: "b", lines: okLines });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- validate-transfer`
Expected: FAIL.

- [ ] **Step 3: Cài đặt tối thiểu**

```typescript
// src/lib/inventory/validate-transfer.ts
export type ValidateResult = { ok: true } | { ok: false; error: string };

export interface TransferRequestLineInput {
  materialId: string;
  qty: number;
}

export function validateTransferRequest(input: {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  lines: TransferRequestLineInput[];
}): ValidateResult {
  if (!input.sourceWarehouseId) return { ok: false, error: "Vui lòng chọn kho nguồn" };
  if (!input.targetWarehouseId) return { ok: false, error: "Vui lòng chọn kho đích" };
  if (input.sourceWarehouseId === input.targetWarehouseId) {
    return { ok: false, error: "Kho nguồn và kho đích phải khác nhau" };
  }
  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      return { ok: false, error: "Số lượng phải lớn hơn 0" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- validate-transfer`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/validate-transfer.ts src/lib/inventory/validate-transfer.test.ts
git commit -m "feat: validate de nghi dieu chuyen (TDD)"
```

---

## Task 3: Phân quyền điều chuyển + kiểm kê + helper dùng chung (can.ts)

**Files:**
- Modify: `src/lib/auth/can.ts`
- Test: `src/lib/auth/can.test.ts` (file đã có; thêm describe mới)

> Ghi chú: thêm cả quyền **kiểm kê** ở task này luôn để gom 1 lần sửa `can.ts` (tránh sửa file nhiều lần). `canModifyPendingDoc` là phiên bản chung dùng cho cả điều chuyển và kiểm kê.

- [ ] **Step 1: Thêm test thất bại vào `can.test.ts`**

Đọc đầu file để biết cách import hiện tại, rồi thêm vào cuối:

```typescript
// thêm vào src/lib/auth/can.test.ts
import {
  canCreateTransfer,
  canApproveTransfer,
  canCreateAdjustment,
  canApproveAdjustment,
  canModifyPendingDoc,
} from "./can";

const tech = { id: "u-tech", companyRole: null };
const cmd = { id: "u-cmd", companyRole: null };
const keeper = { id: "u-keep", companyRole: null };
const admin = { id: "u-admin", companyRole: "ADMIN" as const };
const A = (warehouseId: string, siteRole: "KEEPER" | "TECHNICIAN" | "COMMANDER" | "DEPUTY") => ({ warehouseId, siteRole });

describe("canCreateTransfer", () => {
  it("ADMIN luon duoc", () => {
    expect(canCreateTransfer(admin, [], "w1")).toBe(true);
  });
  it("TECHNICIAN cua kho nguon duoc", () => {
    expect(canCreateTransfer(tech, [A("w1", "TECHNICIAN")], "w1")).toBe(true);
  });
  it("khac kho -> khong", () => {
    expect(canCreateTransfer(tech, [A("w2", "TECHNICIAN")], "w1")).toBe(false);
  });
});

describe("canApproveTransfer", () => {
  it("nguoi lap khong tu duyet", () => {
    expect(canApproveTransfer(cmd, [A("w1", "COMMANDER")], "w1", "u-cmd")).toBe(false);
  });
  it("COMMANDER kho nguon, khac nguoi lap -> duoc", () => {
    expect(canApproveTransfer(cmd, [A("w1", "COMMANDER")], "w1", "u-other")).toBe(true);
  });
  it("DEPUTY kho nguon -> duoc", () => {
    expect(canApproveTransfer(cmd, [A("w1", "DEPUTY")], "w1", "u-other")).toBe(true);
  });
  it("ADMIN khac nguoi lap -> duoc", () => {
    expect(canApproveTransfer(admin, [], "w1", "u-other")).toBe(true);
  });
});

describe("canCreateAdjustment", () => {
  it("KEEPER cua kho -> duoc", () => {
    expect(canCreateAdjustment(keeper, [A("w1", "KEEPER")], "w1")).toBe(true);
  });
  it("TECHNICIAN -> khong", () => {
    expect(canCreateAdjustment(tech, [A("w1", "TECHNICIAN")], "w1")).toBe(false);
  });
  it("ADMIN -> duoc", () => {
    expect(canCreateAdjustment(admin, [], "w1")).toBe(true);
  });
});

describe("canApproveAdjustment", () => {
  it("nguoi lap khong tu duyet", () => {
    expect(canApproveAdjustment(cmd, [A("w1", "COMMANDER")], "w1", "u-cmd")).toBe(false);
  });
  it("COMMANDER khac nguoi lap -> duoc", () => {
    expect(canApproveAdjustment(cmd, [A("w1", "COMMANDER")], "w1", "u-other")).toBe(true);
  });
});

describe("canModifyPendingDoc", () => {
  it("PENDING + dung nguoi lap -> duoc", () => {
    expect(canModifyPendingDoc({ id: "u1", companyRole: null }, { status: "PENDING", createdById: "u1" })).toBe(true);
  });
  it("PENDING + ADMIN -> duoc", () => {
    expect(canModifyPendingDoc(admin, { status: "PENDING", createdById: "u-other" })).toBe(true);
  });
  it("khong PENDING -> khong", () => {
    expect(canModifyPendingDoc({ id: "u1", companyRole: null }, { status: "APPROVED", createdById: "u1" })).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- can`
Expected: FAIL (các hàm chưa tồn tại).

- [ ] **Step 3: Thêm hàm vào `can.ts`**

Thêm vào cuối `src/lib/auth/can.ts` (file đã có `hasRoleAt`, type `Assignment`):

```typescript
/** Lập điều chuyển: ADMIN hoặc TECHNICIAN của kho nguồn. */
export function canCreateTransfer(
  user: { companyRole: CompanyRole | null },
  assignments: Assignment[],
  sourceWarehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, sourceWarehouseId, ["TECHNICIAN"]);
}

/** Duyệt/từ chối điều chuyển: (ADMIN hoặc COMMANDER/DEPUTY của kho nguồn) VÀ không phải người lập. */
export function canApproveTransfer(
  user: { id: string; companyRole: CompanyRole | null },
  assignments: Assignment[],
  sourceWarehouseId: string,
  createdById: string,
): boolean {
  if (user.id === createdById) return false;
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, sourceWarehouseId, ["COMMANDER", "DEPUTY"]);
}

/** Lập kiểm kê: ADMIN hoặc KEEPER của kho. */
export function canCreateAdjustment(
  user: { companyRole: CompanyRole | null },
  assignments: Assignment[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, warehouseId, ["KEEPER"]);
}

/** Duyệt/từ chối kiểm kê: (ADMIN hoặc COMMANDER/DEPUTY của kho) VÀ không phải người lập. */
export function canApproveAdjustment(
  user: { id: string; companyRole: CompanyRole | null },
  assignments: Assignment[],
  warehouseId: string,
  createdById: string,
): boolean {
  if (user.id === createdById) return false;
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, warehouseId, ["COMMANDER", "DEPUTY"]);
}

/** Sửa/hủy phiếu PENDING (chung cho điều chuyển/kiểm kê): phải PENDING, là người lập hoặc ADMIN. */
export function canModifyPendingDoc(
  user: { id: string; companyRole: CompanyRole | null },
  doc: { status: DocumentStatus; createdById: string },
): boolean {
  if (doc.status !== "PENDING") return false;
  return user.companyRole === "ADMIN" || user.id === doc.createdById;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- can`
Expected: PASS (toàn bộ test cũ + mới).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/can.ts src/lib/auth/can.test.ts
git commit -m "feat: phan quyen dieu chuyen + kiem ke + canModifyPendingDoc (TDD)"
```

---

## Task 4: Helper dùng chung + server actions điều chuyển

**Files:**
- Create: `src/lib/inventory/form-helpers.ts`
- Modify: `src/lib/documents/code.ts` (đổi prefix TRANSFER → `PDC`)
- Create: `src/lib/inventory/transfer-actions.ts`

(Không có test đơn vị riêng cho actions — lõi đã test; actions kiểm bằng E2E ở Task 11. tsc phải sạch.)

- [ ] **Step 1: Tạo helper dùng chung**

```typescript
// src/lib/inventory/form-helpers.ts
import { db } from "@/lib/db";

/** Đọc các dòng vật tư từ FormData: material_<i> + <valueKey>_<i>. Trả {materialId, value}. */
export function parseLines(
  formData: FormData,
  valueKey: string,
): { materialId: string; value: number }[] {
  const idx = new Set<string>();
  for (const key of formData.keys()) {
    const m = key.match(/^material_(\d+)$/);
    if (m) idx.add(m[1]);
  }
  const ordered = [...idx].sort((a, b) => Number(a) - Number(b));
  const lines: { materialId: string; value: number }[] = [];
  for (const i of ordered) {
    const materialId = String(formData.get(`material_${i}`) ?? "").trim();
    if (!materialId) continue;
    const value = Number(String(formData.get(`${valueKey}_${i}`) ?? "").trim());
    lines.push({ materialId, value });
  }
  return lines;
}

export async function loadAssignments(userId: string) {
  return db.assignment.findMany({ where: { userId } });
}

/** Xác minh vật tư có thật & đang dùng. */
export async function assertMaterialsValid(materialIds: string[]): Promise<boolean> {
  if (materialIds.length === 0) return true;
  const found = await db.material.findMany({
    where: { id: { in: materialIds }, isActive: true },
    select: { id: true },
  });
  return found.length === materialIds.length;
}
```

- [ ] **Step 2: Đổi prefix số phiếu điều chuyển**

Sửa `src/lib/documents/code.ts`: trong object `PREFIX`, đổi dòng `TRANSFER: "PC",` thành `TRANSFER: "PDC",`. (Giữ nguyên RECEIPT/ISSUE; ADJUSTMENT đổi ở Task 9.)

- [ ] **Step 3: Viết `transfer-actions.ts`**

```typescript
// src/lib/inventory/transfer-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canCreateTransfer, canApproveTransfer, canModifyPendingDoc } from "@/lib/auth/can";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";
import { validateTransferRequest } from "./validate-transfer";
import { computeTransferPostings } from "./transfer-postings";
import { parseLines, loadAssignments, assertMaterialsValid } from "./form-helpers";

export interface TransferFormState {
  error?: string;
}

class StockError extends Error {}

export async function createTransferAction(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const sourceWarehouseId = String(formData.get("warehouseId") ?? "").trim();
  const targetWarehouseId = String(formData.get("targetWarehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "qty");
  const lines = raw.map((l) => ({ materialId: l.materialId, qty: l.value }));

  const v = validateTransferRequest({ sourceWarehouseId, targetWarehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCreateTransfer(user, assignments, sourceWarehouseId)) redirect("/");

  // Kho đích phải tồn tại & đang ACTIVE.
  const target = await db.warehouse.findFirst({ where: { id: targetWarehouseId, status: "ACTIVE" }, select: { id: true } });
  if (!target) return { error: "Kho đích không hợp lệ" };

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  const year = new Date().getFullYear();
  const prefix = documentCodePrefix("TRANSFER");

  let createdId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const count = await tx.document.count({
          where: { type: "TRANSFER", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);
        const doc = await tx.document.create({
          data: {
            code,
            type: "TRANSFER",
            warehouseId: sourceWarehouseId,
            targetWarehouseId,
            status: "PENDING",
            createdById: user.id,
            note,
            documentDate: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(l.qty),
              })),
            },
          },
        });
        return doc.id;
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }

  revalidatePath("/transfers");
  redirect(`/transfers/${createdId}`);
}

export async function updateTransferAction(
  _prev: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const targetWarehouseId = String(formData.get("targetWarehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "qty");
  const lines = raw.map((l) => ({ materialId: l.materialId, qty: l.value }));

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") return { error: "Không tìm thấy phiếu" };

  const v = validateTransferRequest({ sourceWarehouseId: doc.warehouseId, targetWarehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);

  const target = await db.warehouse.findFirst({ where: { id: targetWarehouseId, status: "ACTIVE" }, select: { id: true } });
  if (!target) return { error: "Kho đích không hợp lệ" };

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  await db.$transaction(async (tx) => {
    await tx.documentLine.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        targetWarehouseId,
        note,
        lines: {
          create: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: new Prisma.Decimal(l.qty),
          })),
        },
      },
    });
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

export async function cancelTransferAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") redirect("/transfers");
  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);
  await db.document.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

export async function rejectTransferAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "TRANSFER") redirect("/transfers");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveTransfer(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/transfers/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), reason },
  });
  revalidatePath("/transfers");
  redirect(`/transfers/${id}`);
}

/** Duyệt = áp dụng: trừ kho nguồn (atomic), cộng kho đích, ghi Ledger 2 dòng/vật tư → COMPLETED. */
export async function approveTransferAction(formData: FormData): Promise<TransferFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id }, include: { lines: true } });
  if (!doc || doc.type !== "TRANSFER" || !doc.targetWarehouseId) redirect("/transfers");
  const source = doc.warehouseId;
  const targetId = doc.targetWarehouseId;

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canApproveTransfer(user, assignments, source, doc.createdById)) redirect(`/transfers/${id}`);
  if (doc.status !== "PENDING") return { error: "Phiếu đã được xử lý" };

  const lines = doc.lines.map((l) => ({ materialId: l.materialId, qty: Number(l.requestedQty) }));
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  try {
    await db.$transaction(async (tx) => {
      const stocks = await tx.stock.findMany({ where: { warehouseId: source, materialId: { in: materialIds } } });
      const sourceQty: Record<string, Prisma.Decimal> = {};
      for (const s of stocks) sourceQty[s.materialId] = s.quantity;

      const calc = computeTransferPostings(sourceQty, lines);
      if (!calc.ok) {
        const mats = await tx.material.findMany({
          where: { id: { in: calc.insufficient.map((x) => x.materialId) } },
          select: { id: true, code: true },
        });
        const codeOf = new Map(mats.map((m) => [m.id, m.code]));
        const detail = calc.insufficient
          .map((x) => `${codeOf.get(x.materialId) ?? x.materialId} (còn ${x.available}, cần ${x.needed})`)
          .join("; ");
        throw new StockError(`Không đủ tồn kho nguồn: ${detail}`);
      }

      for (const mv of calc.moves) {
        // Trừ kho nguồn (atomic, chặn âm).
        const res = await tx.stock.updateMany({
          where: { warehouseId: source, materialId: mv.materialId, quantity: { gte: mv.qty } },
          data: { quantity: { decrement: mv.qty } },
        });
        if (res.count === 0) throw new StockError("Tồn kho nguồn vừa thay đổi, không đủ để chuyển. Vui lòng thử lại.");
        const srcAfter = await tx.stock.findUnique({
          where: { warehouseId_materialId: { warehouseId: source, materialId: mv.materialId } },
        });
        await tx.ledger.create({
          data: { warehouseId: source, materialId: mv.materialId, change: mv.qty.negated(), balanceAfter: srcAfter!.quantity, documentId: doc.id },
        });

        // Cộng kho đích (tạo dòng tồn nếu chưa có).
        await tx.stock.upsert({
          where: { warehouseId_materialId: { warehouseId: targetId, materialId: mv.materialId } },
          create: { warehouseId: targetId, materialId: mv.materialId, quantity: mv.qty },
          update: { quantity: { increment: mv.qty } },
        });
        const dstAfter = await tx.stock.findUnique({
          where: { warehouseId_materialId: { warehouseId: targetId, materialId: mv.materialId } },
        });
        await tx.ledger.create({
          data: { warehouseId: targetId, materialId: mv.materialId, change: mv.qty, balanceAfter: dstAfter!.quantity, documentId: doc.id },
        });
      }

      await tx.document.update({
        where: { id },
        data: { status: "COMPLETED", approvedById: user.id, approvedAt: new Date(), completedById: user.id, completedAt: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }

  revalidatePath("/transfers");
  revalidatePath("/stock");
  redirect(`/transfers/${id}`);
}
```

> **Lưu ý Next.js 16:** `redirect()` và các guard-redirect phải nằm NGOÀI `try/catch` (đã tuân thủ — `redirect` ở guard chạy trước transaction, và lần redirect cuối nằm sau khối try/catch). `StockError` được bắt và trả về `{ error }` cho form.

- [ ] **Step 4: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch (không lỗi).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/form-helpers.ts src/lib/documents/code.ts src/lib/inventory/transfer-actions.ts
git commit -m "feat: helper dung chung + server action dieu chuyen (atomic, so phieu PDC)"
```

---

## Task 5: Giao diện điều chuyển (list + form + new + detail + edit + nav)

**Files:**
- Create: `src/app/(app)/transfers/page.tsx`
- Create: `src/app/(app)/transfers/TransferForm.tsx`
- Create: `src/app/(app)/transfers/ApproveTransferButton.tsx`
- Create: `src/app/(app)/transfers/new/page.tsx`
- Create: `src/app/(app)/transfers/[id]/page.tsx`
- Create: `src/app/(app)/transfers/[id]/edit/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Danh sách `transfers/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã chuyển", cls: "text-green-600" },
  REJECTED: { label: "Từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function TransfersPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);
  // Hiện phiếu mà user thấy kho nguồn HOẶC kho đích.
  const whereScope =
    scope === "ALL"
      ? {}
      : { OR: [{ warehouseId: { in: scope } }, { targetWarehouseId: { in: scope } }] };
  const rows = await db.document.findMany({
    where: { type: "TRANSFER", ...whereScope },
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: { select: { code: true, name: true } },
      targetWarehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { lines: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu điều chuyển</h1>
        <Link href="/transfers/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập điều chuyển</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày lập</th>
              <th className="px-3 py-2">Kho nguồn</th>
              <th className="px-3 py-2">Kho đích</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code}</td>
                <td className="px-3 py-2">{d.targetWarehouse?.code ?? "—"}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2"><span className={STATUS[d.status]?.cls}>{STATUS[d.status]?.label}</span></td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/transfers/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu điều chuyển nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Form `transfers/TransferForm.tsx`** (client, dùng cho lập + sửa)

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TransferFormState } from "@/lib/inventory/transfer-actions";

const initial: TransferFormState = {};

interface WarehouseOpt { id: string; code: string; name: string; }
interface MaterialOpt { id: string; code: string; name: string; unit: string; }
interface LineInit { materialId: string; qty: number; }

type Action = (prev: TransferFormState, formData: FormData) => Promise<TransferFormState>;

export function TransferForm({
  action,
  materials,
  sourceWarehouses,
  targetWarehouses,
  fixedSource,
  documentId,
  initialTargetId,
  initialLines,
  initialNote,
}: {
  action: Action;
  materials: MaterialOpt[];
  sourceWarehouses?: WarehouseOpt[];
  targetWarehouses: WarehouseOpt[];
  fixedSource?: WarehouseOpt;
  documentId?: string;
  initialTargetId?: string | null;
  initialLines?: LineInit[];
  initialNote?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const seed = initialLines && initialLines.length > 0 ? initialLines : [{ materialId: "", qty: 0 }];
  const [rows, setRows] = useState(seed.map((l, i) => ({ key: i, ...l })));
  const [nextKey, setNextKey] = useState(seed.length);

  const addRow = () => { setRows((r) => [...r, { key: nextKey, materialId: "", qty: 0 }]); setNextKey((n) => n + 1); };
  const removeRow = (key: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

  return (
    <form action={formAction} className="bg-white rounded-xl shadow p-6 space-y-4">
      {documentId && <input type="hidden" name="id" value={documentId} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="warehouseId">Kho nguồn</label>
          {fixedSource ? (
            <input className="w-full border rounded-lg px-3 py-2 bg-gray-50" value={`${fixedSource.code} — ${fixedSource.name}`} disabled />
          ) : (
            <select id="warehouseId" name="warehouseId" required className="w-full border rounded-lg px-3 py-2">
              {(sourceWarehouses ?? []).map((w) => (<option key={w.id} value={w.id}>{w.code} — {w.name}</option>))}
            </select>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="targetWarehouseId">Kho đích</label>
          <select id="targetWarehouseId" name="targetWarehouseId" required defaultValue={initialTargetId ?? ""} className="w-full border rounded-lg px-3 py-2">
            <option value="">— Chọn kho đích —</option>
            {targetWarehouses.map((w) => (<option key={w.id} value={w.id}>{w.code} — {w.name}</option>))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vật tư điều chuyển</span>
          <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm dòng</button>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
            <select name={`material_${row.key}`} defaultValue={row.materialId} className="col-span-8 border rounded-lg px-2 py-2 text-sm">
              <option value="">— Chọn vật tư —</option>
              {materials.map((m) => (<option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>))}
            </select>
            <input name={`qty_${row.key}`} type="number" min="0" step="any" defaultValue={row.qty || ""} placeholder="SL" className="col-span-3 border rounded-lg px-2 py-2 text-sm" />
            <button type="button" onClick={() => removeRow(row.key)} className="col-span-1 text-red-500 text-sm">×</button>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Ghi chú (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} defaultValue={initialNote ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phiếu"}
        </button>
        <Link href={documentId ? `/transfers/${documentId}` : "/transfers"} className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Trang lập `transfers/new/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { issuableWarehouses } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { createTransferAction } from "@/lib/inventory/transfer-actions";
import { TransferForm } from "../TransferForm";

export default async function NewTransferPage() {
  const user = await requireUser();
  const sources = await issuableWarehouses(user); // ADMIN=tất cả ACTIVE; còn lại = TECHNICIAN
  const targets = await db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const materials = await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  if (sources.length === 0) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">Điều chuyển kho</h1>
        <p className="text-sm text-gray-600">Bạn chưa được phân công làm cán bộ kỹ thuật ở công trình nào, nên chưa thể lập phiếu điều chuyển.</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Lập phiếu điều chuyển</h1>
      <TransferForm
        action={createTransferAction}
        materials={materials}
        sourceWarehouses={sources.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
        targetWarehouses={targets}
      />
    </div>
  );
}
```

- [ ] **Step 4: Nút duyệt client `transfers/ApproveTransferButton.tsx`** (dùng `useActionState` để hiển thị lỗi "không đủ tồn")

```tsx
"use client";

import { useActionState } from "react";
import { approveTransferAction, type TransferFormState } from "@/lib/inventory/transfer-actions";

const initial: TransferFormState = {};

export function ApproveTransferButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(approveTransferAction, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={documentId} />
      <button type="submit" disabled={pending} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
        {pending ? "Đang chuyển..." : "Duyệt & chuyển"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Chi tiết `transfers/[id]/page.tsx`** (nút duyệt/từ chối/sửa/hủy)

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { canApproveTransfer, canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { rejectTransferAction, cancelTransferAction } from "@/lib/inventory/transfer-actions";
import { ApproveTransferButton } from "../ApproveTransferButton";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã chuyển (đã khóa)", cls: "text-green-600" },
  REJECTED: { label: "Đã từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      targetWarehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "TRANSFER") notFound();

  const scope = await viewableWarehouseIds(user);
  const canView = scope === "ALL" || scope.includes(doc.warehouseId) || (doc.targetWarehouseId != null && scope.includes(doc.targetWarehouseId));
  if (!canView) redirect("/");

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  const showModify = canModifyPendingDoc(user, doc);
  const showApprove = doc.status === "PENDING" && canApproveTransfer(user, assignments, doc.warehouseId, doc.createdById);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu điều chuyển {doc.code}</h1>
        <Link href="/transfers" className="text-sm text-gray-600">← Danh sách</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-1">
        <div><span className="text-gray-500">Kho nguồn:</span> {doc.warehouse.code} — {doc.warehouse.name}</div>
        <div><span className="text-gray-500">Kho đích:</span> {doc.targetWarehouse?.code} — {doc.targetWarehouse?.name}</div>
        <div><span className="text-gray-500">Ngày lập:</span> {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        <div><span className="text-gray-500">Người lập:</span> {doc.createdBy.fullName}</div>
        {doc.note && <div><span className="text-gray-500">Ghi chú:</span> {doc.note}</div>}
        {doc.approvedBy && <div><span className="text-gray-500">Người duyệt:</span> {doc.approvedBy.fullName}</div>}
        {doc.status === "REJECTED" && doc.reason && <div><span className="text-gray-500">Lý do từ chối:</span> {doc.reason}</div>}
        <div><span className="text-gray-500">Trạng thái:</span> <span className={STATUS[doc.status]?.cls}>{STATUS[doc.status]?.label}</span></div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">Số lượng</th>
              <th className="px-3 py-2">ĐVT</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.material.code}</td>
                <td className="px-3 py-2">{l.material.name}</td>
                <td className="px-3 py-2 text-right">{Number(l.requestedQty).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{l.material.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {showModify && (
          <>
            <Link href={`/transfers/${doc.id}/edit`} className="border rounded-lg px-4 py-2 text-sm">Sửa</Link>
            <form action={cancelTransferAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="text-red-600 text-sm hover:underline" type="submit">Hủy phiếu</button>
            </form>
          </>
        )}
        {showApprove && (
          <>
            <ApproveTransferButton documentId={doc.id} />
            <form action={rejectTransferAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={doc.id} />
              <input name="reason" placeholder="Lý do từ chối" className="border rounded-lg px-2 py-1.5 text-sm" />
              <button className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm" type="submit">Từ chối</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

> **Lưu ý:** nút "Duyệt & chuyển" dùng component client `ApproveTransferButton` (`useActionState`) để hiển thị lỗi "không đủ tồn kho nguồn" ngay tại trang. `rejectTransferAction`/`cancelTransferAction` trả `Promise<void>` nên dùng form trực tiếp được.

- [ ] **Step 6: Trang sửa `transfers/[id]/edit/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { updateTransferAction } from "@/lib/inventory/transfer-actions";
import { TransferForm } from "../../TransferForm";

export default async function EditTransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: { warehouse: { select: { code: true, name: true } }, lines: true },
  });
  if (!doc || doc.type !== "TRANSFER") notFound();
  if (!canModifyPendingDoc(user, doc)) redirect(`/transfers/${id}`);

  const targets = await db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const materials = await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Sửa phiếu điều chuyển {doc.code}</h1>
      <TransferForm
        action={updateTransferAction}
        materials={materials}
        targetWarehouses={targets}
        fixedSource={{ id: doc.warehouseId, code: doc.warehouse.code, name: doc.warehouse.name }}
        documentId={doc.id}
        initialTargetId={doc.targetWarehouseId}
        initialLines={doc.lines.map((l) => ({ materialId: l.materialId, qty: Number(l.requestedQty) }))}
        initialNote={doc.note}
      />
    </div>
  );
}
```

- [ ] **Step 7: Thêm link nav vào `layout.tsx`**

Trong `<nav>`, sau link `Xuất kho`, thêm:

```tsx
            <Link href="/transfers" className="text-gray-700 hover:text-blue-600">Điều chuyển</Link>
```

- [ ] **Step 8: Kiểm tra kiểu + build nhanh**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/transfers src/app/(app)/layout.tsx
git commit -m "feat: giao dien dieu chuyen (list/form/new/chi tiet/sua/duyet) + nav"
```

---

## Task 6: Lõi tính chênh lệch kiểm kê (adjustment-postings)

**Files:**
- Create: `src/lib/inventory/adjustment-postings.ts`
- Test: `src/lib/inventory/adjustment-postings.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- adjustment-postings`
Expected: FAIL.

- [ ] **Step 3: Cài đặt tối thiểu**

```typescript
// src/lib/inventory/adjustment-postings.ts
import { Prisma } from "@prisma/client";

export interface AdjustmentLine {
  materialId: string;
  countedQty: number;
}

export interface AdjustmentPosting {
  materialId: string;
  change: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

/**
 * Tính chênh lệch kiểm kê (thuần): change = đếm − tồn cũ; balanceAfter = đếm.
 * Bỏ qua dòng không đổi (change = 0). Dòng chưa có tồn coi tồn cũ = 0.
 */
export function computeAdjustmentPostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: AdjustmentLine[],
): AdjustmentPosting[] {
  const postings: AdjustmentPosting[] = [];
  for (const l of lines) {
    const counted = new Prisma.Decimal(l.countedQty);
    const before = currentQty[l.materialId] ?? new Prisma.Decimal(0);
    const change = counted.minus(before);
    if (change.isZero()) continue;
    postings.push({ materialId: l.materialId, change, balanceAfter: counted });
  }
  return postings;
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- adjustment-postings`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/adjustment-postings.ts src/lib/inventory/adjustment-postings.test.ts
git commit -m "feat: loi tinh chenh lech kiem ke (TDD)"
```

---

## Task 7: Validate phiếu kiểm kê (validate-adjustment)

**Files:**
- Create: `src/lib/inventory/validate-adjustment.ts`
- Test: `src/lib/inventory/validate-adjustment.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// src/lib/inventory/validate-adjustment.test.ts
import { describe, it, expect } from "vitest";
import { validateAdjustmentRequest } from "./validate-adjustment";

describe("validateAdjustmentRequest", () => {
  it("thieu kho -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "", lines: [{ materialId: "m1", countedQty: 1 }] });
    expect(r.ok).toBe(false);
  });

  it("khong co dong -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [] });
    expect(r.ok).toBe(false);
  });

  it("so dem am -> loi", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: -1 }] });
    expect(r.ok).toBe(false);
  });

  it("so dem = 0 hop le", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: 0 }] });
    expect(r.ok).toBe(true);
  });

  it("hop le", () => {
    const r = validateAdjustmentRequest({ warehouseId: "w1", lines: [{ materialId: "m1", countedQty: 5 }] });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npm test -- validate-adjustment`
Expected: FAIL.

- [ ] **Step 3: Cài đặt tối thiểu**

```typescript
// src/lib/inventory/validate-adjustment.ts
export type ValidateResult = { ok: true } | { ok: false; error: string };

export interface AdjustmentRequestLineInput {
  materialId: string;
  countedQty: number;
}

export function validateAdjustmentRequest(input: {
  warehouseId: string;
  lines: AdjustmentRequestLineInput[];
}): ValidateResult {
  if (!input.warehouseId) return { ok: false, error: "Vui lòng chọn kho" };
  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };
  for (const l of lines) {
    if (!Number.isFinite(l.countedQty) || l.countedQty < 0) {
      return { ok: false, error: "Số đếm thực tế không hợp lệ (phải ≥ 0)" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npm test -- validate-adjustment`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/validate-adjustment.ts src/lib/inventory/validate-adjustment.test.ts
git commit -m "feat: validate phieu kiem ke (TDD)"
```

---

## Task 8: Server actions kiểm kê (adjustment-actions)

**Files:**
- Modify: `src/lib/documents/code.ts` (đổi prefix ADJUSTMENT → `PKK`)
- Create: `src/lib/inventory/adjustment-actions.ts`

- [ ] **Step 1: Đổi prefix số phiếu kiểm kê**

Sửa `src/lib/documents/code.ts`: đổi `ADJUSTMENT: "KK",` thành `ADJUSTMENT: "PKK",`.

- [ ] **Step 2: Viết `adjustment-actions.ts`**

```typescript
// src/lib/inventory/adjustment-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { canCreateAdjustment, canApproveAdjustment, canModifyPendingDoc } from "@/lib/auth/can";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";
import { validateAdjustmentRequest } from "./validate-adjustment";
import { computeAdjustmentPostings } from "./adjustment-postings";
import { parseLines, loadAssignments, assertMaterialsValid } from "./form-helpers";

export interface AdjustmentFormState {
  error?: string;
}

export async function createAdjustmentAction(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "counted");
  const lines = raw.map((l) => ({ materialId: l.materialId, countedQty: l.value }));

  const v = validateAdjustmentRequest({ warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canCreateAdjustment(user, assignments, warehouseId)) redirect("/");

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  const year = new Date().getFullYear();
  const prefix = documentCodePrefix("ADJUSTMENT");

  let createdId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const count = await tx.document.count({
          where: { type: "ADJUSTMENT", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);
        const doc = await tx.document.create({
          data: {
            code,
            type: "ADJUSTMENT",
            warehouseId,
            status: "PENDING",
            createdById: user.id,
            note,
            documentDate: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(0),
                countedQty: new Prisma.Decimal(l.countedQty),
              })),
            },
          },
        });
        return doc.id;
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }

  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${createdId}`);
}

export async function updateAdjustmentAction(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = parseLines(formData, "counted");
  const lines = raw.map((l) => ({ materialId: l.materialId, countedQty: l.value }));

  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") return { error: "Không tìm thấy phiếu" };

  const v = validateAdjustmentRequest({ warehouseId: doc.warehouseId, lines });
  if (!v.ok) return { error: v.error };

  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);

  const materialIds = [...new Set(lines.map((l) => l.materialId))];
  if (!(await assertMaterialsValid(materialIds))) {
    return { error: "Có vật tư không hợp lệ hoặc đã ngừng sử dụng" };
  }

  await db.$transaction(async (tx) => {
    await tx.documentLine.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: {
        note,
        lines: {
          create: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: new Prisma.Decimal(0),
            countedQty: new Prisma.Decimal(l.countedQty),
          })),
        },
      },
    });
  });

  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

export async function cancelAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const user = await requireUser();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);
  await db.document.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

export async function rejectAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (doc.status !== "PENDING" || !canApproveAdjustment(user, assignments, doc.warehouseId, doc.createdById)) {
    redirect(`/stocktakes/${id}`);
  }
  await db.document.update({
    where: { id },
    data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), reason },
  });
  revalidatePath("/stocktakes");
  redirect(`/stocktakes/${id}`);
}

/** Duyệt = áp dụng: đặt tồn = số đếm (upsert), ghi Ledger chênh lệch → COMPLETED. */
export async function approveAdjustmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const doc = await db.document.findUnique({ where: { id }, include: { lines: true } });
  if (!doc || doc.type !== "ADJUSTMENT") redirect("/stocktakes");
  const warehouseId = doc.warehouseId;

  const user = await requireUser();
  const assignments = await loadAssignments(user.id);
  if (!canApproveAdjustment(user, assignments, warehouseId, doc.createdById)) redirect(`/stocktakes/${id}`);
  if (doc.status !== "PENDING") redirect(`/stocktakes/${id}`);

  const lines = doc.lines
    .filter((l) => l.countedQty != null)
    .map((l) => ({ materialId: l.materialId, countedQty: Number(l.countedQty) }));
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  await db.$transaction(async (tx) => {
    const stocks = await tx.stock.findMany({ where: { warehouseId, materialId: { in: materialIds } } });
    const currentQty: Record<string, Prisma.Decimal> = {};
    for (const s of stocks) currentQty[s.materialId] = s.quantity;

    const postings = computeAdjustmentPostings(currentQty, lines);
    for (const p of postings) {
      await tx.stock.upsert({
        where: { warehouseId_materialId: { warehouseId, materialId: p.materialId } },
        create: { warehouseId, materialId: p.materialId, quantity: p.balanceAfter },
        update: { quantity: p.balanceAfter },
      });
      await tx.ledger.create({
        data: { warehouseId, materialId: p.materialId, change: p.change, balanceAfter: p.balanceAfter, documentId: doc.id },
      });
    }

    await tx.document.update({
      where: { id },
      data: { status: "COMPLETED", approvedById: user.id, approvedAt: new Date(), completedById: user.id, completedAt: new Date() },
    });
  });

  revalidatePath("/stocktakes");
  revalidatePath("/stock");
  redirect(`/stocktakes/${id}`);
}
```

> **Ghi chú nghiệp vụ:** kiểm kê **đặt tồn tuyệt đối** = số đếm. Nếu trong lúc duyệt có phiếu khác vừa đổi tồn, giá trị đếm vẫn được áp (đúng bản chất kiểm kê — phản ánh thực tế đã đếm). Đây là hành vi chấp nhận được, khác với điều chuyển/xuất (trừ tương đối, cần atomic chặn âm).

- [ ] **Step 3: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 4: Commit**

```bash
git add src/lib/documents/code.ts src/lib/inventory/adjustment-actions.ts
git commit -m "feat: server action kiem ke (dat ton = so dem, so phieu PKK)"
```

---

## Task 9: Giao diện kiểm kê (list + form nạp sẵn + new 2 bước + detail + edit + nav)

**Files:**
- Create: `src/app/(app)/stocktakes/page.tsx`
- Create: `src/app/(app)/stocktakes/StocktakeForm.tsx`
- Create: `src/app/(app)/stocktakes/new/page.tsx`
- Create: `src/app/(app)/stocktakes/[id]/page.tsx`
- Create: `src/app/(app)/stocktakes/[id]/edit/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Danh sách `stocktakes/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã điều chỉnh", cls: "text-green-600" },
  REJECTED: { label: "Từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function StocktakesPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);
  const rows = await db.document.findMany({
    where: { type: "ADJUSTMENT", ...(scope === "ALL" ? {} : { warehouseId: { in: scope } }) },
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      _count: { select: { lines: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu kiểm kê</h1>
        <Link href="/stocktakes/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập kiểm kê</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày lập</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code} — {d.warehouse.name}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2"><span className={STATUS[d.status]?.cls}>{STATUS[d.status]?.label}</span></td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/stocktakes/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu kiểm kê nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Form `stocktakes/StocktakeForm.tsx`** (client; nạp sẵn dòng tồn + cho thêm dòng mới)

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AdjustmentFormState } from "@/lib/inventory/adjustment-actions";

const initial: AdjustmentFormState = {};

interface MaterialOpt { id: string; code: string; name: string; unit: string; }
interface PresetLine { materialId: string; code: string; name: string; unit: string; systemQty: number; countedQty: number; }

type Action = (prev: AdjustmentFormState, formData: FormData) => Promise<AdjustmentFormState>;

export function StocktakeForm({
  action,
  warehouse,
  presetLines,
  materials,
  documentId,
  initialNote,
}: {
  action: Action;
  warehouse: { id: string; code: string; name: string };
  presetLines: PresetLine[];
  materials: MaterialOpt[];
  documentId?: string;
  initialNote?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  // Dòng nạp sẵn (vật tư cố định) + dòng thêm mới (chọn vật tư).
  const [preset] = useState(presetLines.map((l, i) => ({ key: i, ...l })));
  const [extra, setExtra] = useState<{ key: number }[]>([]);
  const [nextKey, setNextKey] = useState(presetLines.length);

  const addRow = () => { setExtra((r) => [...r, { key: nextKey }]); setNextKey((n) => n + 1); };
  const removeRow = (key: number) => setExtra((r) => r.filter((x) => x.key !== key));

  return (
    <form action={formAction} className="bg-white rounded-xl shadow p-6 space-y-4">
      <input type="hidden" name="warehouseId" value={warehouse.id} />
      {documentId && <input type="hidden" name="id" value={documentId} />}

      <p className="text-sm text-gray-600">Kho: <b>{warehouse.code} — {warehouse.name}</b></p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Tồn hệ thống</th>
              <th className="px-3 py-2 text-right">Số đếm thực tế</th>
            </tr>
          </thead>
          <tbody>
            {preset.map((l) => (
              <tr key={l.key} className="border-t">
                <td className="px-3 py-2 font-mono">{l.code}</td>
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2 text-right">{l.systemQty.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">
                  <input type="hidden" name={`material_${l.key}`} value={l.materialId} />
                  <input name={`counted_${l.key}`} type="number" min="0" step="any" defaultValue={l.countedQty} className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right" />
                </td>
              </tr>
            ))}
            {extra.map((row) => (
              <tr key={row.key} className="border-t bg-amber-50">
                <td className="px-3 py-2" colSpan={3}>
                  <select name={`material_${row.key}`} className="w-full border rounded-lg px-2 py-1.5 text-sm">
                    <option value="">— Chọn vật tư thêm —</option>
                    {materials.map((m) => (<option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right text-gray-400">0</td>
                <td className="px-3 py-2 text-right flex items-center gap-1 justify-end">
                  <input name={`counted_${row.key}`} type="number" min="0" step="any" defaultValue={0} className="w-24 border rounded-lg px-2 py-1.5 text-sm text-right" />
                  <button type="button" onClick={() => removeRow(row.key)} className="text-red-500 text-sm">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm vật tư chưa có trong danh sách</button>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Ghi chú (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} defaultValue={initialNote ?? ""} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phiếu kiểm kê"}
        </button>
        <Link href={documentId ? `/stocktakes/${documentId}` : "/stocktakes"} className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Trang lập `stocktakes/new/page.tsx`** (2 bước: chọn kho → nạp tồn)

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { receivableWarehouses } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { createAdjustmentAction } from "@/lib/inventory/adjustment-actions";
import { StocktakeForm } from "../StocktakeForm";

export default async function NewStocktakePage({ searchParams }: { searchParams: Promise<{ wh?: string }> }) {
  const { wh } = await searchParams;
  const user = await requireUser();
  const warehouses = await receivableWarehouses(user); // ADMIN=tất cả ACTIVE; còn lại = KEEPER

  if (warehouses.length === 0) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">Kiểm kê kho</h1>
        <p className="text-sm text-gray-600">Bạn chưa được phân công làm thủ kho ở công trình nào, nên chưa thể lập phiếu kiểm kê.</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Về trang chủ</Link>
      </div>
    );
  }

  // Bước 1: chọn kho.
  const selected = wh ? warehouses.find((w) => w.id === wh) : undefined;
  if (!selected) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-lg font-semibold">Lập phiếu kiểm kê — chọn kho</h1>
        <div className="bg-white rounded-xl shadow divide-y">
          {warehouses.map((w) => (
            <Link key={w.id} href={`/stocktakes/new?wh=${w.id}`} className="block px-4 py-3 text-sm hover:bg-gray-50">
              <span className="font-mono">{w.code}</span> — {w.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Bước 2: nạp sẵn tồn hiện tại của kho đã chọn.
  const stocks = await db.stock.findMany({
    where: { warehouseId: selected.id, material: { isActive: true } },
    include: { material: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { material: { code: "asc" } },
  });
  const presetLines = stocks.map((s) => ({
    materialId: s.materialId,
    code: s.material.code,
    name: s.material.name,
    unit: s.material.unit,
    systemQty: Number(s.quantity),
    countedQty: Number(s.quantity),
  }));
  const presetIds = new Set(presetLines.map((l) => l.materialId));
  const materials = (await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  })).filter((m) => !presetIds.has(m.id)); // chỉ vật tư chưa có trong danh sách nạp sẵn

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold">Lập phiếu kiểm kê</h1>
      <StocktakeForm
        action={createAdjustmentAction}
        warehouse={{ id: selected.id, code: selected.code, name: selected.name }}
        presetLines={presetLines}
        materials={materials}
      />
    </div>
  );
}
```

- [ ] **Step 4: Chi tiết `stocktakes/[id]/page.tsx`** (nút duyệt/từ chối/sửa/hủy + cột chênh lệch)

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { canApproveAdjustment, canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { approveAdjustmentAction, rejectAdjustmentAction, cancelAdjustmentAction } from "@/lib/inventory/adjustment-actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "text-amber-600" },
  APPROVED: { label: "Đã duyệt", cls: "text-blue-600" },
  COMPLETED: { label: "Đã điều chỉnh tồn (đã khóa)", cls: "text-green-600" },
  REJECTED: { label: "Đã từ chối", cls: "text-red-600" },
  CANCELLED: { label: "Đã hủy", cls: "text-gray-400" },
};

export default async function StocktakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      approvedBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "ADJUSTMENT") notFound();

  const scope = await viewableWarehouseIds(user);
  if (scope !== "ALL" && !scope.includes(doc.warehouseId)) redirect("/");

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  const showModify = canModifyPendingDoc(user, doc);
  const showApprove = doc.status === "PENDING" && canApproveAdjustment(user, assignments, doc.warehouseId, doc.createdById);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu kiểm kê {doc.code}</h1>
        <Link href="/stocktakes" className="text-sm text-gray-600">← Danh sách</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-1">
        <div><span className="text-gray-500">Kho:</span> {doc.warehouse.code} — {doc.warehouse.name}</div>
        <div><span className="text-gray-500">Ngày lập:</span> {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        <div><span className="text-gray-500">Người lập:</span> {doc.createdBy.fullName}</div>
        {doc.note && <div><span className="text-gray-500">Ghi chú:</span> {doc.note}</div>}
        {doc.approvedBy && <div><span className="text-gray-500">Người duyệt:</span> {doc.approvedBy.fullName}</div>}
        {doc.status === "REJECTED" && doc.reason && <div><span className="text-gray-500">Lý do từ chối:</span> {doc.reason}</div>}
        <div><span className="text-gray-500">Trạng thái:</span> <span className={STATUS[doc.status]?.cls}>{STATUS[doc.status]?.label}</span></div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Số đếm</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.material.code}</td>
                <td className="px-3 py-2">{l.material.name}</td>
                <td className="px-3 py-2">{l.material.unit}</td>
                <td className="px-3 py-2 text-right">{l.countedQty != null ? Number(l.countedQty).toLocaleString("vi-VN") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {showModify && (
          <>
            <Link href={`/stocktakes/${doc.id}/edit`} className="border rounded-lg px-4 py-2 text-sm">Sửa</Link>
            <form action={cancelAdjustmentAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="text-red-600 text-sm hover:underline" type="submit">Hủy phiếu</button>
            </form>
          </>
        )}
        {showApprove && (
          <>
            <form action={approveAdjustmentAction}>
              <input type="hidden" name="id" value={doc.id} />
              <button className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Duyệt & điều chỉnh tồn</button>
            </form>
            <form action={rejectAdjustmentAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={doc.id} />
              <input name="reason" placeholder="Lý do từ chối" className="border rounded-lg px-2 py-1.5 text-sm" />
              <button className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm" type="submit">Từ chối</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Trang sửa `stocktakes/[id]/edit/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canModifyPendingDoc } from "@/lib/auth/can";
import { db } from "@/lib/db";
import { updateAdjustmentAction } from "@/lib/inventory/adjustment-actions";
import { StocktakeForm } from "../../StocktakeForm";

export default async function EditStocktakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      lines: { include: { material: { select: { id: true, code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "ADJUSTMENT") notFound();
  if (!canModifyPendingDoc(user, doc)) redirect(`/stocktakes/${id}`);

  // Lấy tồn hệ thống hiện tại để hiển thị cột "tồn hệ thống".
  const stocks = await db.stock.findMany({ where: { warehouseId: doc.warehouseId } });
  const sysQty = new Map(stocks.map((s) => [s.materialId, Number(s.quantity)]));

  const presetLines = doc.lines.map((l) => ({
    materialId: l.materialId,
    code: l.material.code,
    name: l.material.name,
    unit: l.material.unit,
    systemQty: sysQty.get(l.materialId) ?? 0,
    countedQty: l.countedQty != null ? Number(l.countedQty) : 0,
  }));
  const presetIds = new Set(presetLines.map((l) => l.materialId));
  const materials = (await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  })).filter((m) => !presetIds.has(m.id));

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold">Sửa phiếu kiểm kê {doc.code}</h1>
      <StocktakeForm
        action={updateAdjustmentAction}
        warehouse={{ id: doc.warehouseId, code: doc.warehouse.code, name: doc.warehouse.name }}
        presetLines={presetLines}
        materials={materials}
        documentId={doc.id}
        initialNote={doc.note}
      />
    </div>
  );
}
```

- [ ] **Step 6: Thêm link nav vào `layout.tsx`**

Trong `<nav>`, sau link `Điều chuyển`, thêm:

```tsx
            <Link href="/stocktakes" className="text-gray-700 hover:text-blue-600">Kiểm kê</Link>
```

- [ ] **Step 7: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/stocktakes src/app/(app)/layout.tsx
git commit -m "feat: giao dien kiem ke (nap san ton + duyet dat ton) + nav"
```

---

## Task 10: Kiểm thử toàn bộ + review + merge

**Files:** không sửa code (trừ khi review phát hiện lỗi).

- [ ] **Step 1: Chạy toàn bộ test + tsc**

Run:
```bash
npm test
npx tsc --noEmit
```
Expected: tất cả PASS (≈ 86 cũ + 5 + 6 + 8 + 5 + 5 = ~115 test), tsc sạch.

- [ ] **Step 2: Kiểm thử trên trình duyệt (người dùng)**

Chuẩn bị (vì cấm tự duyệt — cần ≥ 2 người): dùng `admin` (ADMIN) + 1 tài khoản có vai trò Chỉ huy/ Thủ kho/ Kỹ thuật tại kho test. Gợi ý phân công thêm cho `thukho1` tại CT01 các vai trò cần thiết, hoặc tạo `kythuat1`/`chihuy1`.

**Điều chuyển:**
- [ ] Cần ≥ 2 kho ACTIVE. Nếu chỉ có CT01, tạo thêm CT02 (trang Công trình) và phân công.
- [ ] Cán bộ kỹ thuật/Admin lập phiếu CT01 → CT02, vài dòng (≤ tồn CT01) → ra `PDC-2026-0001`, *Chờ duyệt*.
- [ ] Sửa/Hủy khi chờ duyệt hoạt động; người lập không thấy nút Duyệt.
- [ ] Chỉ huy kho nguồn (≠ người lập) **Duyệt & chuyển** → *Đã chuyển*. Vào Tồn kho: CT01 giảm, CT02 tăng đúng.
- [ ] Thử phiếu vượt tồn nguồn → khi duyệt báo "Không đủ tồn kho nguồn".
- [ ] Thử "Từ chối" có lý do → *Đã từ chối*, tồn không đổi.

**Kiểm kê:**
- [ ] Thủ kho/Admin "Lập kiểm kê" → chọn CT01 → màn hình **nạp sẵn toàn bộ tồn**, cột "Tồn hệ thống" đúng.
- [ ] Sửa vài số đếm (tăng 1 món, giảm 1 món), thêm 1 dòng vật tư mới với số đếm > 0 → Lưu → `PKK-2026-0001`, *Chờ duyệt*.
- [ ] Chỉ huy (≠ người lập) "Duyệt & điều chỉnh tồn" → *Đã điều chỉnh*. Vào Tồn kho: các món khớp số đếm; vật tư mới xuất hiện với đúng số.
- [ ] Số đếm = số tồn cũ → không tạo biến động (không lỗi).

- [ ] **Step 3: Review tổng thể nhánh** — dùng superpowers:code-reviewer (hoặc /code-review). Sửa các vấn đề Important. Commit riêng từng sửa.

- [ ] **Step 4: Cập nhật `LICHSU.md`** — đánh dấu KH5 ✅, thêm mục mô tả Điều chuyển + Kiểm kê.

- [ ] **Step 5: Khép nhánh** — dùng superpowers:finishing-a-development-branch: xác minh test → gộp `plan-5-...` vào `master` → push → dọn nhánh. (Theo tiền lệ người dùng thường chọn gộp + push.)

---

## Tổng kết phạm vi

- **Schema:** không đổi.
- **Số phiếu:** `PDC-YYYY-NNNN` (điều chuyển), `PKK-YYYY-NNNN` (kiểm kê).
- **Tồn:** điều chuyển trừ nguồn atomic (chặn âm) + cộng đích; kiểm kê đặt tồn tuyệt đối = số đếm.
- **Phân quyền:** điều chuyển (lập: TECHNICIAN/ADMIN kho nguồn; duyệt: COMMANDER/DEPUTY/ADMIN kho nguồn ≠ người lập); kiểm kê (lập: KEEPER/ADMIN; duyệt: COMMANDER/DEPUTY/ADMIN ≠ người lập). Mọi kiểm tra ở phía máy chủ.
- **Test mới:** transfer-postings (5), validate-transfer (6), can mở rộng (~13), adjustment-postings (5), validate-adjustment (5).
