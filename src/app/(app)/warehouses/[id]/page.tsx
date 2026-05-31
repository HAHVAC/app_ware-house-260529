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
