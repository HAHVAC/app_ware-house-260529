import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { issuableWarehouses } from "@/lib/auth/site-guards";
import { db } from "@/lib/db";
import { createIssueAction } from "@/lib/inventory/issue-actions";
import { IssueForm } from "../IssueForm";

export default async function NewIssuePage() {
  const user = await requireUser();
  const warehouses = await issuableWarehouses(user);
  const materials = await db.material.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, unit: true },
  });

  if (warehouses.length === 0) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">Đề nghị xuất kho</h1>
        <p className="text-sm text-gray-600">Bạn chưa được phân công làm cán bộ kỹ thuật ở công trình nào, nên chưa thể lập đề nghị xuất.</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Lập đề nghị xuất kho</h1>
      <IssueForm action={createIssueAction} materials={materials} warehouses={warehouses} />
    </div>
  );
}
