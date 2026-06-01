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
