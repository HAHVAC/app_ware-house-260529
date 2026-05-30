import { requireAdmin } from "@/lib/auth/guards";
import { UserCreateForm } from "./form";

export default async function NewUserPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Thêm người dùng</h1>
      <UserCreateForm />
    </div>
  );
}
