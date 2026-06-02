import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.companyRole === "ADMIN";
  const isAccountant = user.companyRole === "ACCOUNTANT";

  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  const approverIds = assignments.filter((a) => a.siteRole === "COMMANDER" || a.siteRole === "DEPUTY").map((a) => a.warehouseId);
  const keeperIds = assignments.filter((a) => a.siteRole === "KEEPER").map((a) => a.warehouseId);

  const approverScope = isAdmin ? {} : { warehouseId: { in: approverIds } };
  const keeperScope = isAdmin ? {} : { warehouseId: { in: keeperIds } };

  // Phiếu chờ duyệt (xuất/điều chuyển/kiểm kê) ở kho mình phụ trách.
  const canApproveAny = isAdmin || approverIds.length > 0;
  const pendingApprove = canApproveAny
    ? await db.document.count({ where: { status: "PENDING", type: { in: ["ISSUE", "TRANSFER", "ADJUSTMENT"] }, ...approverScope } })
    : 0;

  // Phiếu xuất đã duyệt chờ thủ kho ghi thực xuất.
  const canKeep = isAdmin || keeperIds.length > 0;
  const awaitingComplete = canKeep
    ? await db.document.count({ where: { status: "APPROVED", type: "ISSUE", ...keeperScope } })
    : 0;

  // Số liệu nhanh cho quản lý/kế toán.
  const showStats = isAdmin || isAccountant;
  const warehouseCount = showStats ? await db.warehouse.count({ where: { status: "ACTIVE" } }) : 0;
  const recentDocs = showStats
    ? await db.document.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { warehouse: { select: { code: true } } } })
    : [];

  const TYPE: Record<string, string> = { RECEIPT: "Nhập", ISSUE: "Xuất", TRANSFER: "Điều chuyển", ADJUSTMENT: "Kiểm kê" };
  const ST: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", COMPLETED: "Hoàn thành", REJECTED: "Từ chối", CANCELLED: "Đã hủy" };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Xin chào, {user.fullName}</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {canApproveAny && (
          <Link href="/issues" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-amber-600">{pendingApprove}</div>
            <div className="text-sm text-gray-600 mt-1">Phiếu chờ bạn duyệt (xuất/điều chuyển/kiểm kê)</div>
          </Link>
        )}
        {canKeep && (
          <Link href="/issues" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-blue-600">{awaitingComplete}</div>
            <div className="text-sm text-gray-600 mt-1">Phiếu xuất đã duyệt chờ ghi thực xuất</div>
          </Link>
        )}
        {showStats && (
          <Link href="/stock?w=all" className="bg-white rounded-xl shadow p-4 hover:shadow-md">
            <div className="text-3xl font-semibold text-gray-800">{warehouseCount}</div>
            <div className="text-sm text-gray-600 mt-1">Kho đang hoạt động · xem tồn &amp; giá trị</div>
          </Link>
        )}
      </div>

      {showStats && recentDocs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-700">Phiếu gần đây</h2>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">Số phiếu</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{d.code}</td>
                    <td className="px-3 py-2">{TYPE[d.type] ?? d.type}</td>
                    <td className="px-3 py-2">{d.warehouse.code}</td>
                    <td className="px-3 py-2">{d.documentDate.toLocaleDateString("vi-VN")}</td>
                    <td className="px-3 py-2">{ST[d.status] ?? d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canApproveAny && !canKeep && !showStats && (
        <p className="text-sm text-gray-600">Chưa có việc cần xử lý. Dùng thanh điều hướng phía trên để thao tác.</p>
      )}
    </div>
  );
}
