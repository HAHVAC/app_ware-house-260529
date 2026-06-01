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
