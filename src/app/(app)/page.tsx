import { getCurrentUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="text-lg font-semibold">Trang tổng quan</h1>
      <p className="text-gray-600 mt-2">
        Xin chào, {user?.fullName}. Hệ thống đang được xây dựng.
      </p>
    </div>
  );
}
