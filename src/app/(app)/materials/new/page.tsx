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
