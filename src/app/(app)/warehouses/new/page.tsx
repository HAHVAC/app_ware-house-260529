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
