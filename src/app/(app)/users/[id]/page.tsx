import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { UserEditForm } from "./form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Sửa người dùng</h1>
      <UserEditForm
        user={{
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          companyRole: user.companyRole,
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
