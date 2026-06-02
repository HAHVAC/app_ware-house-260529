# Kế hoạch 6 (KH6) — Báo cáo, Lịch sử, Dashboard & In phiếu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm báo cáo tồn kho kèm giá trị (xuất Excel), lịch sử giao dịch có lọc (xuất Excel), trang Tổng quan theo vai trò, và in phiếu ra PDF bằng trình duyệt — không đổi cấu trúc database.

**Architecture:** Lõi tính toán thuần (giá trị tồn, parse bộ lọc) viết test trước (TDD). Hàm truy vấn dữ liệu báo cáo tách riêng (`src/lib/reports/`) dùng chung cho trang hiển thị và route xuất Excel (DRY). Xuất Excel qua **Route Handler** (`app/api/reports/.../export/route.ts`) trả file `.xlsx` tải về, dựng workbook bằng `exceljs`. In phiếu = trang in chuyên dụng + CSS `@media print` (Tailwind `print:`), dùng hộp thoại in của trình duyệt. Mọi truy vấn lọc theo `viewableWarehouseIds`.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, server components), Prisma v7, exceljs, Tailwind v4 (biến thể `print:`), Vitest.

---

## Bối cảnh & quyết định đã chốt

- **Phạm vi:** 4 phần — (1) Báo cáo tồn kho + giá trị + Excel; (2) Lịch sử giao dịch + lọc + Excel; (3) Trang Tổng quan (dashboard); (4) In phiếu PDF (in trình duyệt).
- **Không đổi schema.** Dùng `Stock`, `Ledger`, `Document`, `Material`, `Warehouse`.
- **Giá trị tồn** = `tồn × latestUnitPrice`. Vật tư **chưa có đơn giá** → giá trị để trống, **không cộng** vào tổng; đếm số vật tư thiếu giá để chú thích.
- **In PDF** = in trình duyệt: trang in dùng chung `/documents/[id]/print` cho cả 4 loại phiếu; ẩn thanh nav khi in bằng `print:hidden`.
- **Tồn kho:** NÂNG CẤP trang `/stock` hiện có (thêm cột giá trị + tổng + lựa chọn "Tất cả kho" + nút Excel) thay vì tạo trang mới — tránh trùng lặp.
- **Lịch sử:** trang mới `/reports/history` (nguồn `Ledger` nối `Document`).
- **Route Handler Next.js 16:** đọc `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` nếu cần. Mẫu: `export async function GET(request: Request)`, đọc query `new URL(request.url).searchParams`, trả `new Response(buffer, { headers })`. Auth trong route handler dùng `getCurrentUser()` (đọc cookie session).

## File structure (tạo/sửa)

**Lõi thuần (TDD):**
- Create `src/lib/reports/stock-valuation.ts` (+ test) — `computeStockValuation()`.
- Create `src/lib/reports/history-filters.ts` (+ test) — `parseHistoryFilters()`.

**Truy vấn dữ liệu (server, dùng chung trang + export):**
- Create `src/lib/reports/stock-report.ts` — `getStockReportRows(scope, target)`.
- Create `src/lib/reports/history-report.ts` — `getHistoryRows(filters, scope)`.

**Dựng Excel:**
- Create `src/lib/reports/excel.ts` — `stockReportWorkbook(...)`, `historyWorkbook(...)` → `Promise<Buffer>`.

**Route xuất Excel:**
- Create `src/app/api/reports/stock/export/route.ts`.
- Create `src/app/api/reports/history/export/route.ts`.

**Trang & UI:**
- Modify `src/app/(app)/stock/page.tsx` — thêm giá trị + "Tất cả kho" + nút Excel.
- Create `src/app/(app)/reports/history/page.tsx` + `HistoryFilters.tsx` (form lọc client).
- Modify `src/app/(app)/page.tsx` — dashboard theo vai trò.
- Create `src/app/(app)/documents/[id]/print/page.tsx` + `PrintButton.tsx`.
- Modify `src/app/(app)/layout.tsx` — link "Lịch sử"; thêm `print:hidden` cho `<header>`.
- Modify 4 trang chi tiết (`receipts/[id]`, `issues/[id]`, `transfers/[id]`, `stocktakes/[id]`) — thêm link "In phiếu".

---

## Task 1: Lõi tính giá trị tồn (stock-valuation)

**Files:**
- Create: `src/lib/reports/stock-valuation.ts`
- Test: `src/lib/reports/stock-valuation.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// src/lib/reports/stock-valuation.test.ts
import { describe, it, expect } from "vitest";
import { computeStockValuation } from "./stock-valuation";

const row = (code: string, quantity: number, unitPrice: number | null) => ({
  code, name: code, unit: "cái", quantity, unitPrice,
});

describe("computeStockValuation", () => {
  it("co don gia -> value = ton * gia, cong vao tong", () => {
    const r = computeStockValuation([row("A", 10, 1000), row("B", 2, 500)]);
    expect(r.lines[0].value).toBe(10000);
    expect(r.lines[1].value).toBe(1000);
    expect(r.totalValue).toBe(11000);
    expect(r.missingPriceCount).toBe(0);
  });

  it("thieu don gia -> value null, khong cong tong, dem missing", () => {
    const r = computeStockValuation([row("A", 10, 1000), row("B", 5, null)]);
    expect(r.lines[1].value).toBeNull();
    expect(r.totalValue).toBe(10000);
    expect(r.missingPriceCount).toBe(1);
  });

  it("rong -> tong 0", () => {
    const r = computeStockValuation([]);
    expect(r.totalValue).toBe(0);
    expect(r.missingPriceCount).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test FAIL**

Run: `npm test -- stock-valuation`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

```typescript
// src/lib/reports/stock-valuation.ts
export interface StockValuationInput {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
}

export interface StockValuationLine extends StockValuationInput {
  value: number | null;
}

export interface StockValuationResult {
  lines: StockValuationLine[];
  totalValue: number;
  missingPriceCount: number;
}

/** Tính giá trị tồn (thuần): value = tồn × đơn giá; thiếu giá → null, không cộng tổng. */
export function computeStockValuation(rows: StockValuationInput[]): StockValuationResult {
  let totalValue = 0;
  let missingPriceCount = 0;
  const lines: StockValuationLine[] = rows.map((r) => {
    if (r.unitPrice == null) {
      missingPriceCount++;
      return { ...r, value: null };
    }
    const value = r.quantity * r.unitPrice;
    totalValue += value;
    return { ...r, value };
  });
  return { lines, totalValue, missingPriceCount };
}
```

- [ ] **Step 4: Chạy test PASS**

Run: `npm test -- stock-valuation`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/stock-valuation.ts src/lib/reports/stock-valuation.test.ts
git commit -m "feat: loi tinh gia tri ton kho (TDD)"
```

---

## Task 2: Lõi parse bộ lọc lịch sử (history-filters)

**Files:**
- Create: `src/lib/reports/history-filters.ts`
- Test: `src/lib/reports/history-filters.test.ts`

- [ ] **Step 1: Viết test thất bại**

```typescript
// src/lib/reports/history-filters.test.ts
import { describe, it, expect } from "vitest";
import { parseHistoryFilters } from "./history-filters";

describe("parseHistoryFilters", () => {
  it("parse ngay hop le (local), to = cuoi ngay", () => {
    const f = parseHistoryFilters({ from: "2026-01-01", to: "2026-01-31" });
    expect(f.from?.getFullYear()).toBe(2026);
    expect(f.from?.getMonth()).toBe(0);
    expect(f.from?.getDate()).toBe(1);
    expect(f.from?.getHours()).toBe(0);
    expect(f.to?.getDate()).toBe(31);
    expect(f.to?.getHours()).toBe(23);
    expect(f.to?.getMinutes()).toBe(59);
  });

  it("ngay sai dinh dang -> null", () => {
    const f = parseHistoryFilters({ from: "bậy", to: "" });
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
  });

  it("type trong danh sach cho phep", () => {
    expect(parseHistoryFilters({ type: "ISSUE" }).type).toBe("ISSUE");
    expect(parseHistoryFilters({ type: "TRANSFER" }).type).toBe("TRANSFER");
    expect(parseHistoryFilters({ type: "XYZ" }).type).toBeNull();
  });

  it("warehouse/material giu nguyen khi co", () => {
    const f = parseHistoryFilters({ w: "wh1", m: "mat1" });
    expect(f.warehouseId).toBe("wh1");
    expect(f.materialId).toBe("mat1");
  });
});
```

- [ ] **Step 2: Chạy test FAIL**

Run: `npm test -- history-filters`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

```typescript
// src/lib/reports/history-filters.ts
import type { DocumentType } from "@prisma/client";

export interface HistoryFilters {
  from: Date | null;
  to: Date | null;
  warehouseId: string | null;
  materialId: string | null;
  type: DocumentType | null;
}

const TYPES: DocumentType[] = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"];

/** Parse ngày YYYY-MM-DD theo giờ ĐỊA PHƯƠNG (tránh lệch múi giờ). endOfDay=true → 23:59:59.999. */
function parseLocalDate(s: string | undefined, endOfDay: boolean): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const date = endOfDay ? new Date(y, mo, d, 23, 59, 59, 999) : new Date(y, mo, d, 0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export function parseHistoryFilters(params: {
  from?: string; to?: string; w?: string; m?: string; type?: string;
}): HistoryFilters {
  const type = params.type && (TYPES as string[]).includes(params.type)
    ? (params.type as DocumentType) : null;
  return {
    from: parseLocalDate(params.from, false),
    to: parseLocalDate(params.to, true),
    warehouseId: params.w?.trim() || null,
    materialId: params.m?.trim() || null,
    type,
  };
}
```

- [ ] **Step 4: Chạy test PASS**

Run: `npm test -- history-filters`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/history-filters.ts src/lib/reports/history-filters.test.ts
git commit -m "feat: loi parse bo loc lich su giao dich (TDD)"
```

---

## Task 3: Hàm truy vấn dữ liệu báo cáo + dựng Excel

**Files:**
- Create: `src/lib/reports/stock-report.ts`
- Create: `src/lib/reports/history-report.ts`
- Create: `src/lib/reports/excel.ts`

(Không test đơn vị — phụ thuộc DB/exceljs; xác minh bằng tsc + build + E2E.)

- [ ] **Step 1: `stock-report.ts`** — lấy dòng tồn (1 kho hoặc gộp tất cả kho trong phạm vi xem)

```typescript
// src/lib/reports/stock-report.ts
import { db } from "@/lib/db";
import type { StockValuationInput } from "./stock-valuation";

/**
 * Lấy dòng tồn cho báo cáo.
 * @param viewableIds "ALL" hoặc danh sách id kho được xem.
 * @param target id kho cụ thể, hoặc "all" để gộp tất cả kho trong phạm vi (cộng tồn theo vật tư).
 */
export async function getStockReportRows(
  viewableIds: "ALL" | string[],
  target: string,
): Promise<StockValuationInput[]> {
  const scopeWhere = viewableIds === "ALL" ? {} : { warehouseId: { in: viewableIds } };
  const warehouseWhere =
    target === "all" ? scopeWhere
      : { ...scopeWhere, warehouseId: target };

  const stocks = await db.stock.findMany({
    where: warehouseWhere,
    include: { material: { select: { code: true, name: true, unit: true, latestUnitPrice: true } } },
    orderBy: { material: { code: "asc" } },
  });

  if (target === "all") {
    // Gộp theo vật tư (cộng tồn các kho).
    const map = new Map<string, StockValuationInput>();
    for (const s of stocks) {
      const cur = map.get(s.materialId);
      const qty = Number(s.quantity);
      if (cur) {
        cur.quantity += qty;
      } else {
        map.set(s.materialId, {
          code: s.material.code,
          name: s.material.name,
          unit: s.material.unit,
          quantity: qty,
          unitPrice: s.material.latestUnitPrice != null ? Number(s.material.latestUnitPrice) : null,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  return stocks.map((s) => ({
    code: s.material.code,
    name: s.material.name,
    unit: s.material.unit,
    quantity: Number(s.quantity),
    unitPrice: s.material.latestUnitPrice != null ? Number(s.material.latestUnitPrice) : null,
  }));
}
```

- [ ] **Step 2: `history-report.ts`** — lấy dòng sổ kho theo bộ lọc + phạm vi

```typescript
// src/lib/reports/history-report.ts
import { db } from "@/lib/db";
import type { HistoryFilters } from "./history-filters";

export interface HistoryRow {
  id: string;
  date: Date;
  warehouseCode: string;
  warehouseName: string;
  materialCode: string;
  materialName: string;
  unit: string;
  type: string;
  change: number;
  balanceAfter: number;
  documentCode: string;
  createdByName: string;
}

export async function getHistoryRows(
  filters: HistoryFilters,
  viewableIds: "ALL" | string[],
): Promise<HistoryRow[]> {
  const where: Record<string, unknown> = {};

  // Phạm vi xem + lọc kho.
  if (viewableIds !== "ALL") where.warehouseId = { in: viewableIds };
  if (filters.warehouseId) {
    // Nếu đã giới hạn phạm vi, vẫn ưu tiên kho được chọn (giao với phạm vi do where ghi đè key — chấp nhận vì kho được chọn luôn nằm trong phạm vi UI).
    where.warehouseId = filters.warehouseId;
  }
  if (filters.materialId) where.materialId = filters.materialId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.type) where.document = { type: filters.type };

  const rows = await db.ledger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      warehouse: { select: { code: true, name: true } },
      material: { select: { code: true, name: true, unit: true } },
      document: { select: { code: true, type: true, createdBy: { select: { fullName: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    date: r.createdAt,
    warehouseCode: r.warehouse.code,
    warehouseName: r.warehouse.name,
    materialCode: r.material.code,
    materialName: r.material.name,
    unit: r.material.unit,
    type: r.document.type,
    change: Number(r.change),
    balanceAfter: Number(r.balanceAfter),
    documentCode: r.document.code,
    createdByName: r.document.createdBy.fullName,
  }));
}
```

> **Lưu ý:** nếu `viewableIds !== "ALL"` và có `filters.warehouseId`, dòng gán `where.warehouseId = filters.warehouseId` ghi đè phạm vi. Vì dropdown kho trên UI chỉ liệt kê kho trong phạm vi xem, kho được chọn luôn hợp lệ. Để chắc chắn ở phía máy chủ, route/trang PHẢI kiểm `filters.warehouseId` nằm trong phạm vi trước khi dùng (xem Task 5).

- [ ] **Step 3: `excel.ts`** — dựng 2 workbook

```typescript
// src/lib/reports/excel.ts
import ExcelJS from "exceljs";
import type { StockValuationResult } from "./stock-valuation";
import type { HistoryRow } from "./history-report";

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Nhập", ISSUE: "Xuất", TRANSFER: "Điều chuyển", ADJUSTMENT: "Kiểm kê",
};

export async function stockReportWorkbook(
  title: string,
  data: StockValuationResult,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ton kho");
  ws.addRow([title]);
  ws.addRow([]);
  ws.addRow(["Mã VT", "Tên", "ĐVT", "Tồn", "Đơn giá", "Giá trị"]);
  for (const l of data.lines) {
    ws.addRow([l.code, l.name, l.unit, l.quantity, l.unitPrice ?? "", l.value ?? ""]);
  }
  ws.addRow([]);
  ws.addRow(["", "", "", "", "TỔNG GIÁ TRỊ", data.totalValue]);
  if (data.missingPriceCount > 0) {
    ws.addRow([`(${data.missingPriceCount} vật tư chưa có đơn giá, không tính vào tổng)`]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function historyWorkbook(rows: HistoryRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lich su");
  ws.addRow(["Ngày", "Kho", "Mã VT", "Tên VT", "ĐVT", "Loại phiếu", "Biến động", "Tồn sau", "Số phiếu", "Người lập"]);
  for (const r of rows) {
    ws.addRow([
      r.date.toLocaleString("vi-VN"),
      `${r.warehouseCode} — ${r.warehouseName}`,
      r.materialCode, r.materialName, r.unit,
      TYPE_LABEL[r.type] ?? r.type,
      r.change, r.balanceAfter, r.documentCode, r.createdByName,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
```

- [ ] **Step 4: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/stock-report.ts src/lib/reports/history-report.ts src/lib/reports/excel.ts
git commit -m "feat: ham truy van bao cao + dung workbook Excel"
```

---

## Task 4: Báo cáo tồn kho (nâng cấp /stock) + route xuất Excel

**Files:**
- Modify: `src/app/(app)/stock/page.tsx`
- Create: `src/app/api/reports/stock/export/route.ts`

- [ ] **Step 1: Nâng cấp `stock/page.tsx`** — thêm tùy chọn "Tất cả kho", cột Đơn giá/Giá trị, dòng tổng, nút Excel

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { getStockReportRows } from "@/lib/reports/stock-report";
import { computeStockValuation } from "@/lib/reports/stock-valuation";

export default async function StockPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // target: id kho cụ thể, "all", hoặc mặc định kho đầu tiên.
  const valid = w === "all" || warehouses.some((x) => x.id === w);
  const target = valid ? (w as string) : warehouses[0]?.id;

  const rows = target ? await getStockReportRows(scope, target) : [];
  const report = computeStockValuation(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tồn kho{target === "all" ? " — tất cả kho" : ""}</h1>
        {target && (
          <a href={`/api/reports/stock/export?w=${target}`} className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm">⬇ Xuất Excel</a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/stock?w=all`} className={`px-3 py-1.5 rounded-lg text-sm border ${target === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}>Tất cả kho</Link>
        {warehouses.map((x) => (
          <Link key={x.id} href={`/stock?w=${x.id}`} className={`px-3 py-1.5 rounded-lg text-sm border ${x.id === target ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}>
            {x.code} — {x.name}
          </Link>
        ))}
      </div>

      {!target ? (
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
                <th className="px-3 py-2 text-right">Đơn giá (VND)</th>
                <th className="px-3 py-2 text-right">Giá trị (VND)</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono">{l.code}</td>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-right">{l.quantity.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">{l.unit}</td>
                  <td className="px-3 py-2 text-right">{l.unitPrice != null ? l.unitPrice.toLocaleString("vi-VN") : "—"}</td>
                  <td className="px-3 py-2 text-right">{l.value != null ? l.value.toLocaleString("vi-VN") : "—"}</td>
                </tr>
              ))}
              {report.lines.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Chưa có tồn</td></tr>
              )}
            </tbody>
            {report.lines.length > 0 && (
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td className="px-3 py-2" colSpan={5}>TỔNG GIÁ TRỊ TỒN</td>
                  <td className="px-3 py-2 text-right">{report.totalValue.toLocaleString("vi-VN")}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {report.missingPriceCount > 0 && (
        <p className="text-xs text-gray-500">{report.missingPriceCount} vật tư chưa có đơn giá tham khảo nên không tính vào tổng giá trị.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Route xuất Excel tồn kho `app/api/reports/stock/export/route.ts`**

```typescript
// src/app/api/reports/stock/export/route.ts
import { getCurrentUser } from "@/lib/auth/current-user";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { getStockReportRows } from "@/lib/reports/stock-report";
import { computeStockValuation } from "@/lib/reports/stock-valuation";
import { stockReportWorkbook } from "@/lib/reports/excel";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const target = new URL(request.url).searchParams.get("w") ?? "all";
  const scope = await viewableWarehouseIds(user);

  // Kiểm phạm vi: nếu chọn 1 kho cụ thể, phải nằm trong phạm vi xem.
  if (target !== "all" && scope !== "ALL" && !scope.includes(target)) {
    return new Response("Forbidden", { status: 403 });
  }

  let title = "Bao cao ton kho - tat ca kho";
  if (target !== "all") {
    const wh = await db.warehouse.findUnique({ where: { id: target }, select: { code: true, name: true } });
    title = `Bao cao ton kho - ${wh ? `${wh.code} ${wh.name}` : target}`;
  }

  const rows = await getStockReportRows(scope, target);
  const report = computeStockValuation(rows);
  const buf = await stockReportWorkbook(title, report);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ton-kho-${stamp}.xlsx"`,
    },
  });
}
```

- [ ] **Step 3: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/stock/page.tsx" src/app/api/reports/stock/export/route.ts
git commit -m "feat: bao cao ton kho (gia tri ton + tat ca kho + xuat Excel)"
```

---

## Task 5: Lịch sử giao dịch + lọc + route xuất Excel + nav

**Files:**
- Create: `src/app/(app)/reports/history/page.tsx`
- Create: `src/app/(app)/reports/history/HistoryFilters.tsx`
- Create: `src/app/api/reports/history/export/route.ts`
- Modify: `src/app/(app)/layout.tsx` (link "Lịch sử")

- [ ] **Step 1: Form lọc client `HistoryFilters.tsx`** (GET form, giữ giá trị qua searchParams)

```tsx
"use client";

interface Opt { id: string; code: string; name: string; }

export function HistoryFilters({
  warehouses, materials, current,
}: {
  warehouses: Opt[];
  materials: { id: string; code: string; name: string }[];
  current: { from?: string; to?: string; w?: string; m?: string; type?: string };
}) {
  return (
    <form method="get" className="bg-white rounded-xl shadow p-4 grid sm:grid-cols-3 gap-3 text-sm">
      <div className="space-y-1">
        <label className="text-gray-600">Từ ngày</label>
        <input type="date" name="from" defaultValue={current.from ?? ""} className="w-full border rounded-lg px-2 py-1.5" />
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Đến ngày</label>
        <input type="date" name="to" defaultValue={current.to ?? ""} className="w-full border rounded-lg px-2 py-1.5" />
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Loại phiếu</label>
        <select name="type" defaultValue={current.type ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          <option value="RECEIPT">Nhập</option>
          <option value="ISSUE">Xuất</option>
          <option value="TRANSFER">Điều chuyển</option>
          <option value="ADJUSTMENT">Kiểm kê</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Kho</label>
        <select name="w" defaultValue={current.w ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          {warehouses.map((x) => (<option key={x.id} value={x.id}>{x.code} — {x.name}</option>))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-gray-600">Vật tư</label>
        <select name="m" defaultValue={current.m ?? ""} className="w-full border rounded-lg px-2 py-1.5">
          <option value="">— Tất cả —</option>
          {materials.map((x) => (<option key={x.id} value={x.id}>{x.code} — {x.name}</option>))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">Lọc</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Trang `reports/history/page.tsx`**

```tsx
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { parseHistoryFilters } from "@/lib/reports/history-filters";
import { getHistoryRows } from "@/lib/reports/history-report";
import { HistoryFilters } from "./HistoryFilters";

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  RECEIPT: { label: "Nhập", cls: "text-green-600" },
  ISSUE: { label: "Xuất", cls: "text-blue-600" },
  TRANSFER: { label: "Điều chuyển", cls: "text-purple-600" },
  ADJUSTMENT: { label: "Kiểm kê", cls: "text-amber-600" },
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; w?: string; m?: string; type?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = await viewableWarehouseIds(user);

  const warehouses = await db.warehouse.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    orderBy: { code: "asc" }, select: { id: true, code: true, name: true },
  });
  const materials = await db.material.findMany({
    orderBy: { code: "asc" }, select: { id: true, code: true, name: true },
  });

  const filters = parseHistoryFilters(sp);
  // Chặn lọc kho ngoài phạm vi xem.
  if (filters.warehouseId && scope !== "ALL" && !scope.includes(filters.warehouseId)) {
    filters.warehouseId = null;
  }
  const rows = await getHistoryRows(filters, scope);

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lịch sử giao dịch</h1>
        <a href={`/api/reports/history/export${qs ? `?${qs}` : ""}`} className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm">⬇ Xuất Excel</a>
      </div>

      <HistoryFilters warehouses={warehouses} materials={materials} current={sp} />

      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2">Vật tư</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2 text-right">Biến động</th>
              <th className="px-3 py-2 text-right">Tồn sau</th>
              <th className="px-3 py-2">Số phiếu</th>
              <th className="px-3 py-2">Người lập</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.date.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2">{r.warehouseCode}</td>
                <td className="px-3 py-2"><span className="font-mono">{r.materialCode}</span> {r.materialName}</td>
                <td className="px-3 py-2"><span className={TYPE_LABEL[r.type]?.cls}>{TYPE_LABEL[r.type]?.label ?? r.type}</span></td>
                <td className={`px-3 py-2 text-right ${r.change < 0 ? "text-red-600" : "text-green-600"}`}>{r.change > 0 ? "+" : ""}{r.change.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-right">{r.balanceAfter.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 font-mono">{r.documentCode}</td>
                <td className="px-3 py-2">{r.createdByName}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Không có giao dịch khớp bộ lọc</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Hiển thị tối đa 1000 dòng gần nhất. Dùng bộ lọc để thu hẹp.</p>
    </div>
  );
}
```

- [ ] **Step 3: Route xuất Excel lịch sử `app/api/reports/history/export/route.ts`**

```typescript
// src/app/api/reports/history/export/route.ts
import { getCurrentUser } from "@/lib/auth/current-user";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { parseHistoryFilters } from "@/lib/reports/history-filters";
import { getHistoryRows } from "@/lib/reports/history-report";
import { historyWorkbook } from "@/lib/reports/excel";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const p = new URL(request.url).searchParams;
  const filters = parseHistoryFilters({
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    w: p.get("w") ?? undefined,
    m: p.get("m") ?? undefined,
    type: p.get("type") ?? undefined,
  });

  const scope = await viewableWarehouseIds(user);
  if (filters.warehouseId && scope !== "ALL" && !scope.includes(filters.warehouseId)) {
    filters.warehouseId = null;
  }

  const rows = await getHistoryRows(filters, scope);
  const buf = await historyWorkbook(rows);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lich-su-${stamp}.xlsx"`,
    },
  });
}
```

- [ ] **Step 4: Thêm link nav "Lịch sử"** trong `layout.tsx`, sau link "Tồn kho":

```tsx
            <Link href="/reports/history" className="text-gray-700 hover:text-blue-600">Lịch sử</Link>
```

- [ ] **Step 5: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/reports" src/app/api/reports/history/export/route.ts "src/app/(app)/layout.tsx"
git commit -m "feat: lich su giao dich (loc + xuat Excel) + nav"
```

---

## Task 6: Trang Tổng quan (dashboard) theo vai trò

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Viết lại `page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.companyRole === "ADMIN";
  const isAccountant = user.companyRole === "ACCOUNTANT";

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  const approverIds = assignments.filter((a) => a.siteRole === "COMMANDER" || a.siteRole === "DEPUTY").map((a) => a.warehouseId);
  const keeperIds = assignments.filter((a) => a.siteRole === "KEEPER").map((a) => a.warehouseId);

  const approverScope = isAdmin ? {} : { warehouseId: { in: approverIds } };
  const keeperScope = isAdmin ? {} : { warehouseId: { in: keeperIds } };

  // Phiếu chờ duyệt (xuất/điều chuyển/kiểm kê) ở kho mình phụ trách.
  const canApproveAny = isAdmin || approverIds.length > 0;
  const pendingApprove = canApproveAny
    ? await db.document.count({ where: { status: "PENDING", type: { in: ["ISSUE", "TRANSFER", "ADJUSTMENT"] }, ...approverScope } })
    : 0;

  // Phiếu xuất đã duyệt chờ thủ kho ghi thực xuất.
  const canKeep = isAdmin || keeperIds.length > 0;
  const awaitingComplete = canKeep
    ? await db.document.count({ where: { status: "APPROVED", type: "ISSUE", ...keeperScope } })
    : 0;

  // Số liệu nhanh cho quản lý/kế toán.
  const showStats = isAdmin || isAccountant;
  const warehouseCount = showStats ? await db.warehouse.count({ where: { status: "ACTIVE" } }) : 0;
  const recentDocs = showStats
    ? await db.document.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { warehouse: { select: { code: true } } } })
    : [];

  const TYPE: Record<string, string> = { RECEIPT: "Nhập", ISSUE: "Xuất", TRANSFER: "Điều chuyển", ADJUSTMENT: "Kiểm kê" };
  const ST: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", COMPLETED: "Hoàn thành", REJECTED: "Từ chối", CANCELLED: "Đã hủy" };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Xin chào, {user.fullName}</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {canApproveAny && (
          <Link href="/issues" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-amber-600">{pendingApprove}</div>
            <div className="text-sm text-gray-600 mt-1">Phiếu chờ bạn duyệt (xuất/điều chuyển/kiểm kê)</div>
          </Link>
        )}
        {canKeep && (
          <Link href="/issues" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-blue-600">{awaitingComplete}</div>
            <div className="text-sm text-gray-600 mt-1">Phiếu xuất đã duyệt chờ ghi thực xuất</div>
          </Link>
        )}
        {showStats && (
          <Link href="/stock?w=all" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-gray-800">{warehouseCount}</div>
            <div className="text-sm text-gray-600 mt-1">Kho đang hoạt động · xem tồn & giá trị</div>
          </Link>
        )}
      </div>

      {showStats && recentDocs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-700">Phiếu gần đây</h2>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">Số phiếu</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{d.code}</td>
                    <td className="px-3 py-2">{TYPE[d.type] ?? d.type}</td>
                    <td className="px-3 py-2">{d.warehouse.code}</td>
                    <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                    <td className="px-3 py-2">{ST[d.status] ?? d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canApproveAny && !canKeep && !showStats && (
        <p className="text-sm text-gray-600">Chưa có việc cần xử lý. Dùng thanh điều hướng phía trên để thao tác.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: trang tong quan (dashboard) theo vai tro"
```

---

## Task 7: In phiếu ra PDF (trang in dùng chung + nút in)

**Files:**
- Create: `src/app/(app)/documents/[id]/print/page.tsx`
- Create: `src/app/(app)/documents/[id]/print/PrintButton.tsx`
- Modify: `src/app/(app)/layout.tsx` (thêm `print:hidden` cho `<header>`)
- Modify: `src/app/(app)/receipts/[id]/page.tsx`, `issues/[id]/page.tsx`, `transfers/[id]/page.tsx`, `stocktakes/[id]/page.tsx` (thêm link "In phiếu")

- [ ] **Step 1: Nút in client `PrintButton.tsx`**

```tsx
"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="print:hidden bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">
      In phiếu
    </button>
  );
}
```

- [ ] **Step 2: Trang in `documents/[id]/print/page.tsx`** (dùng chung 4 loại)

```tsx
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { PrintButton } from "./PrintButton";

const DOC_TITLE: Record<string, string> = {
  RECEIPT: "PHIẾU NHẬP KHO", ISSUE: "PHIẾU XUẤT KHO",
  TRANSFER: "PHIẾU ĐIỀU CHUYỂN", ADJUSTMENT: "PHIẾU KIỂM KÊ",
};
// Nhãn cột số lượng + chữ ký theo loại phiếu.
const SIGN: Record<string, string[]> = {
  RECEIPT: ["Người lập phiếu", "Thủ kho"],
  ISSUE: ["Người lập phiếu", "Người duyệt", "Thủ kho", "Người nhận"],
  TRANSFER: ["Người lập phiếu", "Người duyệt", "Thủ kho kho nguồn", "Thủ kho kho đích"],
  ADJUSTMENT: ["Người lập phiếu", "Người duyệt", "Thủ kho"],
};

function qtyOf(type: string, line: { requestedQty: unknown; actualQty: unknown; countedQty: unknown }): number {
  if (type === "ISSUE") return Number(line.actualQty ?? line.requestedQty);
  if (type === "ADJUSTMENT") return Number(line.countedQty ?? 0);
  return Number(line.requestedQty);
}

export default async function PrintDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      warehouse: { select: { code: true, name: true } },
      targetWarehouse: { select: { code: true, name: true } },
      createdBy: { select: { fullName: true } },
      lines: { include: { material: { select: { code: true, name: true, unit: true } } } },
    },
  });
  if (!doc) notFound();

  const scope = await viewableWarehouseIds(user);
  const canView = scope === "ALL" || scope.includes(doc.warehouseId) || (doc.targetWarehouseId != null && scope.includes(doc.targetWarehouseId));
  if (!canView) redirect("/");

  const signers = SIGN[doc.type] ?? ["Người lập phiếu"];

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 text-sm text-black">
      <div className="flex justify-end mb-4"><PrintButton /></div>

      <div className="text-center space-y-1 mb-6">
        <div className="font-semibold uppercase">Công ty [Tên công ty]</div>
        <div className="text-xs text-gray-600">PCCC &amp; Cơ điện</div>
        <h1 className="text-xl font-bold mt-3">{DOC_TITLE[doc.type] ?? "PHIẾU KHO"}</h1>
        <div className="font-mono">Số: {doc.code}</div>
      </div>

      <div className="space-y-1 mb-4">
        <div>Ngày: {doc.documentDate.toLocaleDateString("vi-VN")}</div>
        {doc.type === "TRANSFER" ? (
          <div>Từ kho: <b>{doc.warehouse.code} — {doc.warehouse.name}</b> → Đến kho: <b>{doc.targetWarehouse?.code} — {doc.targetWarehouse?.name}</b></div>
        ) : (
          <div>Kho: <b>{doc.warehouse.code} — {doc.warehouse.name}</b></div>
        )}
        <div>Người lập: {doc.createdBy.fullName}</div>
        {doc.recipient && <div>Người nhận: {doc.recipient}</div>}
        {doc.note && <div>Ghi chú: {doc.note}</div>}
        {doc.reason && <div>Lý do: {doc.reason}</div>}
      </div>

      <table className="w-full border-collapse mb-8">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">STT</th>
            <th className="border px-2 py-1 text-left">Mã VT</th>
            <th className="border px-2 py-1 text-left">Tên vật tư</th>
            <th className="border px-2 py-1 text-left">ĐVT</th>
            <th className="border px-2 py-1 text-right">Số lượng</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="border px-2 py-1">{i + 1}</td>
              <td className="border px-2 py-1 font-mono">{l.material.code}</td>
              <td className="border px-2 py-1">{l.material.name}</td>
              <td className="border px-2 py-1">{l.material.unit}</td>
              <td className="border px-2 py-1 text-right">{qtyOf(doc.type, l).toLocaleString("vi-VN")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${signers.length}, minmax(0, 1fr))` }}>
        {signers.map((s) => (
          <div key={s} className="text-center">
            <div className="font-medium">{s}</div>
            <div className="text-xs text-gray-500">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ẩn thanh nav khi in** — trong `layout.tsx`, thêm `print:hidden` vào class của `<header>`:

Sửa `<header className="border-b bg-white px-4 py-3 flex items-center justify-between">` thành `<header className="border-b bg-white px-4 py-3 flex items-center justify-between print:hidden">`.

- [ ] **Step 4: Thêm link "In phiếu" vào 4 trang chi tiết**

Mỗi trang chi tiết, trong cụm nút/hành động hoặc cạnh tiêu đề, thêm link (mở tab mới để in):

```tsx
            <Link href={`/documents/${doc.id}/print`} target="_blank" className="border rounded-lg px-4 py-2 text-sm">In phiếu</Link>
```
- `receipts/[id]/page.tsx`: thêm cạnh link "← Danh sách" hoặc dưới bảng.
- `issues/[id]/page.tsx`, `transfers/[id]/page.tsx`, `stocktakes/[id]/page.tsx`: thêm vào cụm nút hành động (luôn hiển thị, không phụ thuộc trạng thái).

(Bảo đảm mỗi file đã `import Link from "next/link";` — đa số đã có.)

- [ ] **Step 5: Kiểm tra kiểu**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/documents" "src/app/(app)/layout.tsx" "src/app/(app)/receipts/[id]/page.tsx" "src/app/(app)/issues/[id]/page.tsx" "src/app/(app)/transfers/[id]/page.tsx" "src/app/(app)/stocktakes/[id]/page.tsx"
git commit -m "feat: in phieu ra PDF (trang in dung chung + nut in tren chi tiet)"
```

---

## Task 8: Kiểm thử toàn bộ + build + review + LICHSU + merge

**Files:** không sửa code (trừ khi review phát hiện lỗi).

- [ ] **Step 1: Test + tsc + build**

Run:
```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: test PASS (≈ cũ + 3 + 4 = +7), tsc sạch, build thành công (có route `/api/reports/...`, trang `/reports/history`, `/documents/[id]/print`).

- [ ] **Step 2: Kiểm thử trên trình duyệt (người dùng)**
  - Tồn kho: chọn "Tất cả kho" → thấy giá trị + tổng; bấm "Xuất Excel" tải file mở được; vật tư thiếu giá hiện "—" và có chú thích.
  - Lịch sử: lọc theo ngày/kho/loại phiếu → bảng đúng; "Xuất Excel" giữ bộ lọc.
  - Tổng quan: đăng nhập từng vai trò thấy số liệu phù hợp (chờ duyệt / chờ xuất / số liệu nhanh).
  - In phiếu: mở 1 phiếu nhập/xuất/điều chuyển/kiểm kê → "In phiếu" → trang in sạch (không có thanh nav) → hộp thoại in lưu PDF được, có khu vực ký.

- [ ] **Step 3: Review tổng thể nhánh** — superpowers:code-reviewer. Trọng tâm: phân quyền route export (chặn kho ngoài phạm vi), rò rỉ dữ liệu kho không được xem, đúng kiểu Next 16 (params/searchParams await, Response). Sửa vấn đề Important.

- [ ] **Step 4: Cập nhật `LICHSU.md`** — đánh dấu KH6 ✅, mô tả 4 phần. Đánh dấu dự án hoàn thành lộ trình 6 KH.

- [ ] **Step 5: Khép nhánh** — superpowers:finishing-a-development-branch: test → gộp `plan-6-reports` vào `master` → push → dọn nhánh.

---

## Tổng kết phạm vi

- **Schema:** không đổi.
- **Lõi test trước:** `computeStockValuation` (3), `parseHistoryFilters` (4).
- **Báo cáo tồn kho:** /stock nâng cấp (giá trị + tất cả kho + Excel). **Lịch sử:** /reports/history (lọc + Excel). **Dashboard:** / theo vai trò. **In phiếu:** /documents/[id]/print + CSS in.
- **Xuất Excel:** route handler `/api/reports/stock/export`, `/api/reports/history/export` — kiểm auth + phạm vi xem.
- **Không ngoài phạm vi:** không thêm biểu đồ, không cảnh báo tồn tối thiểu, không phân quyền mới (dùng `viewableWarehouseIds` sẵn có).
