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
