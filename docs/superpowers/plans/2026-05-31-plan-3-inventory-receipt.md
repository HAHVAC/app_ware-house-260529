# Kế hoạch 3: Lõi tồn kho + Nhập kho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng lõi tồn kho (Stock/Document/DocumentLine/Ledger) và luồng **Nhập kho** — thủ kho/quản lý lập phiếu nhập, hiệu lực ngay, tăng tồn + ghi sổ kho nguyên tử trong một transaction.

**Architecture:** Thêm 4 model dùng chung cho cả 4 loại phiếu, nhưng KH3 chỉ hiện thực loại `RECEIPT`. Logic tồn kho tách thành **pure function** (`computeReceiptPostings`) test trước (TDD); server action gọi pure function rồi ghi DB trong `$transaction`. Phân quyền theo vai trò tại kho (Thủ kho của kho đó **hoặc** Quản lý) kiểm tra ở phía máy chủ. Số phiếu `PN-YYYY-NNNN` tự sinh, an toàn đồng thời bằng retry-on-unique.

**Tech Stack:** Next.js 16 (App Router, server actions, `useActionState`), Prisma v7 (driver adapter, `$transaction`), `Prisma.Decimal` cho số lượng/giá, Vitest, Tailwind v4.

**Quyết định nghiệp vụ (đã chốt với người dùng):**
1. **Quyền lập phiếu nhập:** Thủ kho (`KEEPER`) được phân công tại kho đó **HOẶC** Quản lý (`ADMIN`).
2. **Ngày nhập:** có ô `documentDate` (mặc định hôm nay, cho phép lùi ngày).
3. **Đơn giá từng dòng:** **tùy chọn**; nếu có thì cập nhật `Material.latestUnitPrice`.

**Quy ước quan trọng (đọc trước khi code):**
- Prisma v7: dùng `db` singleton ở `src/lib/db.ts` (driver adapter). KHÔNG `new PrismaClient()` trần. Migration: `npx prisma migrate dev --name <ten>` (đã cấu hình `prisma.config.ts`).
- `Prisma.Decimal` từ `@prisma/client`. Khi truyền dữ liệu từ server component → client component phải đổi Decimal sang `Number(...)` hoặc `.toString()`.
- Server action: `redirect()` đặt **NGOÀI** `try/catch`. Action dùng với `useActionState` trả về `{ error?: string }`.
- Thông báo/giao diện tiếng Việt. Tiền tệ VND (`.toLocaleString("vi-VN")`).
- Bám pattern sẵn có: form xem `src/app/(app)/materials/new/form.tsx`; page+guard xem `src/app/(app)/materials/new/page.tsx`; list xem `src/app/(app)/materials/page.tsx`; validate thuần xem `src/lib/materials/validate.ts` (trả `{ ok: true } | { ok: false; error }`).

---

## Cấu trúc file

**Tạo mới:**
- `src/lib/inventory/postings.ts` — pure `computeReceiptPostings` (lõi tồn kho).
- `src/lib/inventory/postings.test.ts`
- `src/lib/inventory/validate-receipt.ts` — pure `validateReceiptInput`.
- `src/lib/inventory/validate-receipt.test.ts`
- `src/lib/documents/code.ts` — pure `documentCodePrefix`, `formatDocumentCode`.
- `src/lib/documents/code.test.ts`
- `src/lib/auth/can.ts` — pure `canCreateReceipt`.
- `src/lib/auth/can.test.ts`
- `src/lib/auth/site-guards.ts` — async `requireReceiptCreator`, `assertCanViewWarehouse`.
- `src/lib/inventory/receipt-actions.ts` — server action `createReceiptAction` (transactional).
- `src/app/(app)/receipts/page.tsx` — danh sách phiếu nhập.
- `src/app/(app)/receipts/new/page.tsx` — trang lập phiếu (fetch kho được phép + vật tư).
- `src/app/(app)/receipts/new/form.tsx` — form nhiều dòng (client).
- `src/app/(app)/receipts/[id]/page.tsx` — chi tiết phiếu (chỉ đọc, đã khóa).
- `src/app/(app)/stock/page.tsx` — xem tồn kho theo kho.

**Sửa:**
- `prisma/schema.prisma` — thêm 2 enum + 4 model + back-relations.
- `src/app/(app)/layout.tsx` — thêm link "Nhập kho" + "Tồn kho".

---

## Task 1: Schema tồn kho + phiếu + sổ kho + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Thêm 2 enum vào `prisma/schema.prisma`** (đặt cạnh các enum khác)

```prisma
enum DocumentType {
  RECEIPT
  ISSUE
  TRANSFER
  ADJUSTMENT
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
  CANCELLED
}
```

- [ ] **Step 2: Thêm 4 model mới**

```prisma
model Stock {
  id          String    @id @default(uuid())
  warehouseId String
  materialId  String
  quantity    Decimal   @default(0)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  material    Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@unique([warehouseId, materialId])
}

model Document {
  id                String         @id @default(uuid())
  code              String         @unique
  type              DocumentType
  warehouseId       String
  targetWarehouseId String?
  status            DocumentStatus
  createdById       String
  approvedById      String?
  completedById     String?
  recipient         String?
  reason            String?
  note              String?
  documentDate      DateTime
  createdAt         DateTime       @default(now())
  approvedAt        DateTime?
  completedAt       DateTime?

  warehouse       Warehouse      @relation("DocWarehouse", fields: [warehouseId], references: [id])
  targetWarehouse Warehouse?     @relation("DocTargetWarehouse", fields: [targetWarehouseId], references: [id])
  createdBy       User           @relation("DocCreatedBy", fields: [createdById], references: [id])
  approvedBy      User?          @relation("DocApprovedBy", fields: [approvedById], references: [id])
  completedBy     User?          @relation("DocCompletedBy", fields: [completedById], references: [id])
  lines           DocumentLine[]
  ledgers         Ledger[]
}

model DocumentLine {
  id           String   @id @default(uuid())
  documentId   String
  materialId   String
  requestedQty Decimal
  actualQty    Decimal?
  countedQty   Decimal?
  unitPrice    Decimal?
  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  material     Material @relation(fields: [materialId], references: [id])
}

model Ledger {
  id           String    @id @default(uuid())
  warehouseId  String
  materialId   String
  change       Decimal
  balanceAfter Decimal
  documentId   String
  createdAt    DateTime  @default(now())
  warehouse    Warehouse @relation(fields: [warehouseId], references: [id])
  material     Material  @relation(fields: [materialId], references: [id])
  document     Document  @relation(fields: [documentId], references: [id])
}
```

- [ ] **Step 3: Thêm back-relations vào các model sẵn có**

Trong `model User { ... }` thêm:
```prisma
  createdDocuments   Document[] @relation("DocCreatedBy")
  approvedDocuments  Document[] @relation("DocApprovedBy")
  completedDocuments Document[] @relation("DocCompletedBy")
```

Trong `model Warehouse { ... }` thêm:
```prisma
  stocks          Stock[]
  documents       Document[] @relation("DocWarehouse")
  targetDocuments Document[] @relation("DocTargetWarehouse")
  ledgers         Ledger[]
```

Trong `model Material { ... }` thêm:
```prisma
  stocks        Stock[]
  documentLines DocumentLine[]
  ledgers       Ledger[]
```

- [ ] **Step 4: Chạy migration**

Run: `npx prisma migrate dev --name add_inventory`
Expected: tạo migration mới, áp dụng thành công, `prisma generate` chạy lại (client có Stock/Document/...).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: model ton kho + phieu + so kho (Stock/Document/DocumentLine/Ledger)"
```

---

## Task 2: Lõi tồn kho `computeReceiptPostings` (TDD)

Pure function tính biến động tồn cho phiếu nhập. Xử lý đúng khi **nhiều dòng cùng một vật tư** (cộng dồn tuần tự, `balanceAfter` tăng dần). Đây là phần lõi, ưu tiên test cao nhất (spec mục 9).

**Files:**
- Create: `src/lib/inventory/postings.ts`
- Test: `src/lib/inventory/postings.test.ts`

- [ ] **Step 1: Viết test trước**

```typescript
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { computeReceiptPostings } from "./postings";

const D = (n: number | string) => new Prisma.Decimal(n);

describe("computeReceiptPostings", () => {
  it("vat tu chua co ton -> balanceAfter = qty", () => {
    const r = computeReceiptPostings({}, [{ materialId: "m1", qty: 10 }]);
    expect(r.postings).toHaveLength(1);
    expect(r.postings[0].balanceAfter.toString()).toBe("10");
    expect(r.postings[0].change.toString()).toBe("10");
    expect(r.newStock["m1"].toString()).toBe("10");
  });

  it("cong vao ton hien co", () => {
    const r = computeReceiptPostings({ m1: D(5) }, [{ materialId: "m1", qty: 3 }]);
    expect(r.postings[0].balanceAfter.toString()).toBe("8");
    expect(r.newStock["m1"].toString()).toBe("8");
  });

  it("nhieu dong cung vat tu -> cong don tuan tu, balanceAfter tang dan", () => {
    const r = computeReceiptPostings({}, [
      { materialId: "m1", qty: 10 },
      { materialId: "m1", qty: 5 },
    ]);
    expect(r.postings.map((p) => p.balanceAfter.toString())).toEqual(["10", "15"]);
    expect(r.newStock["m1"].toString()).toBe("15");
  });

  it("nhieu vat tu doc lap", () => {
    const r = computeReceiptPostings({ m2: D(2) }, [
      { materialId: "m1", qty: 1 },
      { materialId: "m2", qty: 4 },
    ]);
    expect(r.newStock["m1"].toString()).toBe("1");
    expect(r.newStock["m2"].toString()).toBe("6");
  });

  it("so luong thap phan", () => {
    const r = computeReceiptPostings({}, [{ materialId: "m1", qty: 1.5 }]);
    expect(r.newStock["m1"].toString()).toBe("1.5");
  });
});
```

- [ ] **Step 2: Chạy test để thấy fail**

Run: `npm test -- postings`
Expected: FAIL (chưa có `computeReceiptPostings`).

- [ ] **Step 3: Hiện thực tối thiểu**

```typescript
import { Prisma } from "@prisma/client";

export interface ReceiptPostingLine {
  materialId: string;
  qty: number;
}

export interface Posting {
  materialId: string;
  change: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
}

export interface ReceiptPostingResult {
  postings: Posting[];
  newStock: Record<string, Prisma.Decimal>;
}

/**
 * Tính biến động tồn cho phiếu nhập (thuần, không chạm DB).
 * @param currentQty tồn hiện tại theo materialId (thiếu = 0)
 * @param lines các dòng nhập (đã hợp lệ: qty > 0)
 */
export function computeReceiptPostings(
  currentQty: Record<string, Prisma.Decimal>,
  lines: ReceiptPostingLine[],
): ReceiptPostingResult {
  const newStock: Record<string, Prisma.Decimal> = {};
  for (const [k, v] of Object.entries(currentQty)) newStock[k] = new Prisma.Decimal(v);

  const postings: Posting[] = [];
  for (const line of lines) {
    const before = newStock[line.materialId] ?? new Prisma.Decimal(0);
    const change = new Prisma.Decimal(line.qty);
    const after = before.plus(change);
    newStock[line.materialId] = after;
    postings.push({ materialId: line.materialId, change, balanceAfter: after });
  }

  return { postings, newStock };
}
```

- [ ] **Step 4: Chạy test để pass**

Run: `npm test -- postings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/postings.ts src/lib/inventory/postings.test.ts
git commit -m "feat: loi tinh ton kho phieu nhap (TDD)"
```

---

## Task 3: Validate phiếu nhập `validateReceiptInput` (TDD)

**Files:**
- Create: `src/lib/inventory/validate-receipt.ts`
- Test: `src/lib/inventory/validate-receipt.test.ts`

Quy tắc: phải có `warehouseId`; `documentDate` parse được; ít nhất 1 dòng có `materialId`; mỗi dòng hợp lệ: `materialId` không rỗng, `qty` hữu hạn > 0, `price` là `null` hoặc số hữu hạn ≥ 0. Cho phép trùng vật tư giữa các dòng (sẽ cộng dồn).

- [ ] **Step 1: Viết test trước**

```typescript
import { describe, it, expect } from "vitest";
import { validateReceiptInput } from "./validate-receipt";

const base = {
  warehouseId: "w1",
  documentDate: "2026-05-31",
  note: null as string | null,
  lines: [{ materialId: "m1", qty: 10, price: 1000 }],
};

describe("validateReceiptInput", () => {
  it("hop le", () => {
    expect(validateReceiptInput(base).ok).toBe(true);
  });
  it("thieu kho -> loi", () => {
    expect(validateReceiptInput({ ...base, warehouseId: "" }).ok).toBe(false);
  });
  it("ngay khong hop le -> loi", () => {
    expect(validateReceiptInput({ ...base, documentDate: "khong-phai-ngay" }).ok).toBe(false);
  });
  it("khong co dong nao -> loi", () => {
    expect(validateReceiptInput({ ...base, lines: [] }).ok).toBe(false);
  });
  it("dong thieu materialId -> loi", () => {
    const r = validateReceiptInput({ ...base, lines: [{ materialId: "", qty: 1, price: null }] });
    expect(r.ok).toBe(false);
  });
  it("qty <= 0 -> loi", () => {
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 0, price: null }] }).ok).toBe(false);
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: -2, price: null }] }).ok).toBe(false);
  });
  it("price null hop le; price am loi", () => {
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 1, price: null }] }).ok).toBe(true);
    expect(validateReceiptInput({ ...base, lines: [{ materialId: "m1", qty: 1, price: -5 }] }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để fail** — Run: `npm test -- validate-receipt` → FAIL.

- [ ] **Step 3: Hiện thực**

```typescript
export interface ReceiptLineInput {
  materialId: string;
  qty: number;
  price: number | null;
}

export interface ReceiptInput {
  warehouseId: string;
  documentDate: string;
  note: string | null;
  lines: ReceiptLineInput[];
}

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateReceiptInput(input: ReceiptInput): ValidateResult {
  if (!input.warehouseId) return { ok: false, error: "Vui lòng chọn kho" };

  const t = Date.parse(input.documentDate);
  if (!input.documentDate || Number.isNaN(t)) {
    return { ok: false, error: "Ngày nhập không hợp lệ" };
  }

  const lines = input.lines.filter((l) => l.materialId);
  if (lines.length === 0) return { ok: false, error: "Phiếu phải có ít nhất một dòng vật tư" };

  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      return { ok: false, error: "Số lượng phải lớn hơn 0" };
    }
    if (l.price !== null && (!Number.isFinite(l.price) || l.price < 0)) {
      return { ok: false, error: "Đơn giá không hợp lệ" };
    }
  }

  return { ok: true };
}
```

- [ ] **Step 4: Chạy test để pass** — Run: `npm test -- validate-receipt` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory/validate-receipt.ts src/lib/inventory/validate-receipt.test.ts
git commit -m "feat: validate phieu nhap (TDD)"
```

---

## Task 4: Số phiếu + phân quyền (pure, TDD)

**Files:**
- Create: `src/lib/documents/code.ts`, `src/lib/documents/code.test.ts`
- Create: `src/lib/auth/can.ts`, `src/lib/auth/can.test.ts`

- [ ] **Step 1: Viết test số phiếu** (`src/lib/documents/code.test.ts`)

```typescript
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
```

- [ ] **Step 2: Viết test phân quyền** (`src/lib/auth/can.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { canCreateReceipt } from "./can";

describe("canCreateReceipt", () => {
  const keeperW1 = [{ warehouseId: "w1", siteRole: "KEEPER" as const }];
  it("ADMIN duoc moi kho", () => {
    expect(canCreateReceipt({ companyRole: "ADMIN" }, [], "w1")).toBe(true);
  });
  it("KEEPER cua kho do -> duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, keeperW1, "w1")).toBe(true);
  });
  it("KEEPER kho khac -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, keeperW1, "w2")).toBe(false);
  });
  it("vai tro khac (TECHNICIAN) -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: null }, [{ warehouseId: "w1", siteRole: "TECHNICIAN" as const }], "w1")).toBe(false);
  });
  it("ACCOUNTANT khong phai keeper -> khong duoc", () => {
    expect(canCreateReceipt({ companyRole: "ACCOUNTANT" }, [], "w1")).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy cả hai test để fail** — Run: `npm test -- code can` → FAIL.

- [ ] **Step 4: Hiện thực `src/lib/documents/code.ts`**

```typescript
import type { DocumentType } from "@prisma/client";

const PREFIX: Record<DocumentType, string> = {
  RECEIPT: "PN",
  ISSUE: "PX",
  TRANSFER: "PC",
  ADJUSTMENT: "KK",
};

export function documentCodePrefix(type: DocumentType): string {
  return PREFIX[type];
}

export function formatDocumentCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
```

- [ ] **Step 5: Hiện thực `src/lib/auth/can.ts`**

```typescript
import type { CompanyRole, SiteRole } from "@prisma/client";

/** Quyết định ai được lập phiếu nhập: ADMIN, hoặc KEEPER của chính kho đó. */
export function canCreateReceipt(
  user: { companyRole: CompanyRole | null },
  assignments: { warehouseId: string; siteRole: SiteRole }[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return assignments.some((a) => a.warehouseId === warehouseId && a.siteRole === "KEEPER");
}
```

- [ ] **Step 6: Chạy test để pass** — Run: `npm test -- code can` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documents/code.ts src/lib/documents/code.test.ts src/lib/auth/can.ts src/lib/auth/can.test.ts
git commit -m "feat: sinh so phieu + phan quyen lap phieu nhap (TDD)"
```

---

## Task 5: Site guards (DB)

Bọc pure `canCreateReceipt` + đọc DB. `requireReceiptCreator` trả user nếu được phép, ngược lại `redirect("/")`. `assertCanViewWarehouse` cho trang xem (ADMIN hoặc có bất kỳ assignment nào ở kho đó).

**Files:**
- Create: `src/lib/auth/site-guards.ts`

- [ ] **Step 1: Viết file**

```typescript
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "./guards";
import { canCreateReceipt } from "./can";

/** Trả user nếu được lập phiếu nhập tại kho này, ngược lại về trang chủ. */
export async function requireReceiptCreator(warehouseId: string) {
  const user = await requireUser();
  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  if (!canCreateReceipt(user, assignments, warehouseId)) redirect("/");
  return user;
}

/** Danh sách id kho mà user được lập phiếu nhập (ADMIN = tất cả kho ACTIVE). */
export async function receivableWarehouses(user: { id: string; companyRole: string | null }) {
  if (user.companyRole === "ADMIN") {
    return db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  }
  const assignments = await db.assignment.findMany({
    where: { userId: user.id, siteRole: "KEEPER" },
    select: { warehouseId: true },
  });
  const ids = assignments.map((a) => a.warehouseId);
  return db.warehouse.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, orderBy: { code: "asc" } });
}

/** Danh sách id kho mà user được XEM (ADMIN/ACCOUNTANT = tất cả; site user = kho được phân công). */
export async function viewableWarehouseIds(user: { id: string; companyRole: string | null }): Promise<"ALL" | string[]> {
  if (user.companyRole === "ADMIN" || user.companyRole === "ACCOUNTANT") return "ALL";
  const assignments = await db.assignment.findMany({
    where: { userId: user.id },
    select: { warehouseId: true },
  });
  return [...new Set(assignments.map((a) => a.warehouseId))];
}
```

- [ ] **Step 2: Kiểm tra biên dịch** — Run: `npx tsc --noEmit` → không lỗi ở file này.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/site-guards.ts
git commit -m "feat: site guards cho lap phieu + xem kho"
```

---

## Task 6: Server action lập phiếu nhập (transactional)

Action: parse FormData → validate → phân quyền → trong `$transaction`: đọc tồn hiện tại, tính postings, sinh số phiếu (retry P2002), tạo Document(COMPLETED)+DocumentLines+upsert Stock+Ledger, cập nhật `latestUnitPrice` cho dòng có giá → redirect chi tiết phiếu.

**Files:**
- Create: `src/lib/inventory/receipt-actions.ts`

- [ ] **Step 1: Viết file**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireReceiptCreator } from "@/lib/auth/site-guards";
import { validateReceiptInput, type ReceiptLineInput } from "./validate-receipt";
import { computeReceiptPostings } from "./postings";
import { documentCodePrefix, formatDocumentCode } from "@/lib/documents/code";

export interface ReceiptFormState {
  error?: string;
}

/** Đọc các dòng từ FormData: material_<i>, qty_<i>, price_<i>. */
function parseLines(formData: FormData): ReceiptLineInput[] {
  const indexes = new Set<string>();
  for (const key of formData.keys()) {
    const m = key.match(/^material_(\d+)$/);
    if (m) indexes.add(m[1]);
  }
  const lines: ReceiptLineInput[] = [];
  for (const i of indexes) {
    const materialId = String(formData.get(`material_${i}`) ?? "").trim();
    if (!materialId) continue;
    const qty = Number(String(formData.get(`qty_${i}`) ?? "").trim());
    const priceRaw = String(formData.get(`price_${i}`) ?? "").trim();
    const price = priceRaw === "" ? null : Number(priceRaw);
    lines.push({ materialId, qty, price });
  }
  return lines;
}

export async function createReceiptAction(
  _prev: ReceiptFormState,
  formData: FormData,
): Promise<ReceiptFormState> {
  const warehouseId = String(formData.get("warehouseId") ?? "").trim();
  const documentDate = String(formData.get("documentDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const lines = parseLines(formData);

  const v = validateReceiptInput({ warehouseId, documentDate, note, lines });
  if (!v.ok) return { error: v.error };

  // Phân quyền (redirect nếu không được phép — nằm ngoài try/catch bên dưới)
  const user = await requireReceiptCreator(warehouseId);

  const year = new Date(documentDate).getFullYear();
  const prefix = documentCodePrefix("RECEIPT");
  const materialIds = [...new Set(lines.map((l) => l.materialId))];

  let createdId = "";
  // Retry khi trùng số phiếu (P2002) do tạo đồng thời
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      createdId = await db.$transaction(async (tx) => {
        const stocks = await tx.stock.findMany({
          where: { warehouseId, materialId: { in: materialIds } },
        });
        const currentQty: Record<string, Prisma.Decimal> = {};
        for (const s of stocks) currentQty[s.materialId] = s.quantity;

        const { postings, newStock } = computeReceiptPostings(currentQty, lines);

        const count = await tx.document.count({
          where: { type: "RECEIPT", code: { startsWith: `${prefix}-${year}-` } },
        });
        const code = formatDocumentCode(prefix, year, count + 1);

        const doc = await tx.document.create({
          data: {
            code,
            type: "RECEIPT",
            warehouseId,
            status: "COMPLETED",
            createdById: user.id,
            completedById: user.id,
            note,
            documentDate: new Date(documentDate),
            completedAt: new Date(),
            lines: {
              create: lines.map((l) => ({
                materialId: l.materialId,
                requestedQty: new Prisma.Decimal(l.qty),
                unitPrice: l.price === null ? null : new Prisma.Decimal(l.price),
              })),
            },
          },
        });

        // Cập nhật tồn
        for (const [materialId, qty] of Object.entries(newStock)) {
          await tx.stock.upsert({
            where: { warehouseId_materialId: { warehouseId, materialId } },
            create: { warehouseId, materialId, quantity: qty },
            update: { quantity: qty },
          });
        }

        // Ghi sổ kho
        await tx.ledger.createMany({
          data: postings.map((p) => ({
            warehouseId,
            materialId: p.materialId,
            change: p.change,
            balanceAfter: p.balanceAfter,
            documentId: doc.id,
          })),
        });

        // Cập nhật đơn giá tham khảo cho dòng có giá
        for (const l of lines) {
          if (l.price !== null) {
            await tx.material.update({
              where: { id: l.materialId },
              data: { latestUnitPrice: new Prisma.Decimal(l.price) },
            });
          }
        }

        return doc.id;
      });
      break; // thành công
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        attempt < 4
      ) {
        continue; // trùng số phiếu → thử lại
      }
      throw e;
    }
  }

  revalidatePath("/receipts");
  revalidatePath("/stock");
  redirect(`/receipts/${createdId}`);
}
```

> Lưu ý: `where: { warehouseId_materialId: { ... } }` là tên khóa duy nhất Prisma tự sinh từ `@@unique([warehouseId, materialId])`. Nếu Prisma sinh tên khác, dùng đúng tên client gợi ý.

- [ ] **Step 2: Kiểm tra biên dịch** — Run: `npx tsc --noEmit` → không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inventory/receipt-actions.ts
git commit -m "feat: server action lap phieu nhap (transaction + retry so phieu)"
```

---

## Task 7: Trang lập phiếu nhập (form nhiều dòng)

**Files:**
- Create: `src/app/(app)/receipts/new/page.tsx`
- Create: `src/app/(app)/receipts/new/form.tsx`

- [ ] **Step 1: `new/page.tsx`** — server component: lấy user, kho được phép nhập (`receivableWarehouses`), vật tư active. Nếu không có kho nào được phép → hiện thông báo.

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { receivableWarehouses } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { ReceiptCreateForm } from "./form";

export default async function NewReceiptPage() {
  const user = await requireUser();
  const warehouses = await receivableWarehouses(user);
  const materials = await db.material.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  if (warehouses.length === 0) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">Nhập kho</h1>
        <p className="text-sm text-gray-600">
          Bạn chưa được phân công làm thủ kho ở công trình nào, nên chưa thể lập phiếu nhập.
        </p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Về trang chủ</Link>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Lập phiếu nhập kho</h1>
      <ReceiptCreateForm warehouses={warehouses} materials={materials} today={today} />
    </div>
  );
}
```

- [ ] **Step 2: `new/form.tsx`** — client component. Quản lý mảng dòng trong state; mỗi dòng index `i` render `material_<i>`, `qty_<i>`, `price_<i>`. Có nút "+ Thêm dòng" và "Xóa" mỗi dòng. Chọn kho, ngày (mặc định `today`), ghi chú.

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createReceiptAction, type ReceiptFormState } from "@/lib/inventory/receipt-actions";

const initial: ReceiptFormState = {};

interface WarehouseOpt { id: string; code: string; name: string; }
interface MaterialOpt { id: string; code: string; name: string; unit: string; }

export function ReceiptCreateForm({
  warehouses,
  materials,
  today,
}: {
  warehouses: WarehouseOpt[];
  materials: MaterialOpt[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createReceiptAction, initial);
  const [rows, setRows] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  const addRow = () => {
    setRows((r) => [...r, nextId]);
    setNextId((n) => n + 1);
  };
  const removeRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r));

  return (
    <form action={action} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="warehouseId">Công trình / Kho</label>
          <select id="warehouseId" name="warehouseId" required className="w-full border rounded-lg px-3 py-2">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="documentDate">Ngày nhập</label>
          <input id="documentDate" name="documentDate" type="date" defaultValue={today} required className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Vật tư</span>
          <button type="button" onClick={addRow} className="text-blue-600 text-sm hover:underline">+ Thêm dòng</button>
        </div>
        <div className="space-y-2">
          {rows.map((id) => (
            <div key={id} className="grid grid-cols-12 gap-2 items-center">
              <select name={`material_${id}`} className="col-span-6 border rounded-lg px-2 py-2 text-sm">
                <option value="">— Chọn vật tư —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} — {m.name} ({m.unit})</option>
                ))}
              </select>
              <input name={`qty_${id}`} type="number" min="0" step="any" placeholder="SL" className="col-span-2 border rounded-lg px-2 py-2 text-sm" />
              <input name={`price_${id}`} type="number" min="0" step="any" placeholder="Đơn giá" className="col-span-3 border rounded-lg px-2 py-2 text-sm" />
              <button type="button" onClick={() => removeRow(id)} className="col-span-1 text-red-500 text-sm">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="note">Ghi chú (tùy chọn)</label>
        <textarea id="note" name="note" rows={2} className="w-full border rounded-lg px-3 py-2" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Đang lưu..." : "Lưu phiếu nhập"}
        </button>
        <Link href="/receipts" className="px-4 py-2 text-sm text-gray-600">Hủy</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Kiểm tra biên dịch** — Run: `npx tsc --noEmit` → không lỗi.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/receipts/new"
git commit -m "feat: trang lap phieu nhap kho (form nhieu dong)"
```

---

## Task 8: Danh sách + chi tiết phiếu nhập

**Files:**
- Create: `src/app/(app)/receipts/page.tsx`
- Create: `src/app/(app)/receipts/[id]/page.tsx`

- [ ] **Step 1: `receipts/page.tsx`** — danh sách phiếu nhập user được xem (ADMIN/ACCOUNTANT = tất cả; site user = kho được phân công).

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function ReceiptsPage() {
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const receipts = await db.document.findMany({
    where: {
      type: "RECEIPT",
      ...(scope === "ALL" ? {} : { warehouseId: { in: scope } }),
    },
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
        <h1 className="text-lg font-semibold">Phiếu nhập kho</h1>
        <Link href="/receipts/new" className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">+ Lập phiếu nhập</Link>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Ngày nhập</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-right">Số dòng</th>
              <th className="px-3 py-2">Người lập</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                <td className="px-3 py-2">{d.warehouse.code} — {d.warehouse.name}</td>
                <td className="px-3 py-2 text-right">{d._count.lines}</td>
                <td className="px-3 py-2">{d.createdBy.fullName}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/receipts/${d.id}`} className="text-blue-600 hover:underline">Xem</Link>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Chưa có phiếu nhập nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `receipts/[id]/page.tsx`** — chi tiết, chỉ đọc. Kiểm tra quyền xem (ADMIN/ACCOUNTANT hoặc kho thuộc phạm vi). `params` là Promise (Next 16) → `await params`. Đổi Decimal sang `Number(...)` khi hiển thị.

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc || doc.type !== "RECEIPT") notFound();

  const scope = await viewableWarehouseIds(user);
  if (scope !== "ALL" && !scope.includes(doc.warehouseId)) redirect("/");

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phiếu nhập {doc.code}</h1>
        <Link href="/receipts" className="text-sm text-gray-600">← Danh sách</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-4 text-sm space-y-1">
        <div><span className="text-gray-500">Kho:</span> {doc.warehouse.code} — {doc.warehouse.name}</div>
        <div><span className="text-gray-500">Ngày nhập:</span> {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        <div><span className="text-gray-500">Người lập:</span> {doc.createdBy.fullName}</div>
        {doc.note && <div><span className="text-gray-500">Ghi chú:</span> {doc.note}</div>}
        <div><span className="text-gray-500">Trạng thái:</span> <span className="text-green-600">Đã hoàn thành (đã khóa)</span></div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Mã VT</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">Số lượng</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.material.code}</td>
                <td className="px-3 py-2">{l.material.name}</td>
                <td className="px-3 py-2 text-right">{Number(l.requestedQty).toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{l.material.unit}</td>
                <td className="px-3 py-2 text-right">
                  {l.unitPrice != null ? Number(l.unitPrice).toLocaleString("vi-VN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Phiếu nhập có hiệu lực ngay khi lập và không thể sửa/xóa. Sai sót xử lý bằng phiếu kiểm kê/điều chỉnh (kế hoạch sau).</p>
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra biên dịch** — Run: `npx tsc --noEmit` → không lỗi.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/receipts/page.tsx" "src/app/(app)/receipts/[id]"
git commit -m "feat: danh sach + chi tiet phieu nhap"
```

---

## Task 9: Trang xem tồn kho + cập nhật nav

**Files:**
- Create: `src/app/(app)/stock/page.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: `stock/page.tsx`** — chọn kho qua `?w=<id>`; mặc định kho đầu trong phạm vi xem. Hiển thị bảng tồn (vật tư + số lượng). `searchParams` là Promise (Next 16) → `await searchParams`.

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const selectedId = w && warehouses.some((x) => x.id === w) ? w : warehouses[0]?.id;

  const stocks = selectedId
    ? await db.stock.findMany({
        where: { warehouseId: selectedId },
        include: { material: { select: { code: true, name: true, unit: true } } },
        orderBy: { material: { code: "asc" } },
      })
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Tồn kho</h1>

      <div className="flex flex-wrap gap-2">
        {warehouses.map((x) => (
          <Link
            key={x.id}
            href={`/stock?w=${x.id}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${x.id === selectedId ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
          >
            {x.code} — {x.name}
          </Link>
        ))}
      </div>

      {!selectedId ? (
        <p className="text-sm text-gray-500">Chưa có kho nào để xem.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Mã VT</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2 text-right">Tồn</th>
                <th className="px-3 py-2">ĐVT</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{s.material.code}</td>
                  <td className="px-3 py-2">{s.material.name}</td>
                  <td className="px-3 py-2 text-right">{Number(s.quantity).toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">{s.material.unit}</td>
                </tr>
              ))}
              {stocks.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Kho này chưa có tồn</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sửa `layout.tsx`** — thêm link "Nhập kho" (ADMIN hoặc KEEPER bất kỳ) và "Tồn kho" (mọi người đăng nhập).

Thêm trước `return`:
```tsx
  const canReceive =
    isAdmin ||
    (await db.assignment.count({ where: { userId: user.id, siteRole: "KEEPER" } })) > 0;
```
(Thêm `import { db } from "@/lib/db";` ở đầu file.)

Trong `<nav>`, sau link "Vật tư", thêm:
```tsx
            {canReceive && (
              <Link href="/receipts" className="text-gray-700 hover:text-blue-600">Nhập kho</Link>
            )}
            <Link href="/stock" className="text-gray-700 hover:text-blue-600">Tồn kho</Link>
```

- [ ] **Step 3: Kiểm tra biên dịch** — Run: `npx tsc --noEmit` → không lỗi.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/stock/page.tsx" "src/app/(app)/layout.tsx"
git commit -m "feat: trang ton kho + link nav Nhap kho/Ton kho"
```

---

## Task 10: Kiểm thử end-to-end + toàn bộ test

- [ ] **Step 1: Chạy toàn bộ unit test**

Run: `npm test`
Expected: tất cả PASS. KH3 thêm: `postings` (5), `validate-receipt` (7), `code` (2), `can` (5) = 19 test mới (cùng 36 cũ → ~55). (Nếu lần đầu báo "no tests" do race sau khi đổi file thì chạy lại.)

- [ ] **Step 2: Kiểm thử trên trình duyệt** (người dùng thực hiện, agent khởi động `npm run dev`)
  - Đăng nhập admin. Thấy link "Nhập kho" + "Tồn kho".
  - Vào "Nhập kho" → "Lập phiếu nhập": chọn kho, ngày (mặc định hôm nay), thêm 2–3 dòng vật tư + số lượng (+ vài dòng có đơn giá), lưu → chuyển sang chi tiết phiếu `PN-2026-0001`, trạng thái "Đã hoàn thành (đã khóa)".
  - Vào "Tồn kho", chọn đúng kho → thấy tồn đúng bằng số vừa nhập.
  - Lập thêm 1 phiếu nhập nữa cùng kho, cùng vật tư → tồn cộng dồn đúng; số phiếu `PN-2026-0002`.
  - Kiểm tra đơn giá: vật tư có nhập giá → "Vật tư" hiển thị đơn giá tham khảo mới nhất đã cập nhật.
  - Thử lưu phiếu không có dòng nào / số lượng 0 → báo lỗi tiếng Việt, không tạo phiếu.
  - "Phiếu nhập" → danh sách hiển thị các phiếu vừa lập.

- [ ] **Step 3: Final review toàn nhánh** (qua `superpowers:code-reviewer`), sửa Important nếu có, rồi merge theo `superpowers:finishing-a-development-branch`.

---

## Ngoài phạm vi KH3 (để các kế hoạch sau)
- Xuất kho (KH4), điều chuyển + kiểm kê (KH5) — model đã chừa sẵn các trường (`actualQty`, `countedQty`, `targetWarehouseId`, `approvedById`...).
- Báo cáo tồn kho đầy đủ (giá trị tồn = tồn × đơn giá), lịch sử giao dịch, xuất Excel/PDF (KH6).
- Kho tổng (`CENTRAL`).
