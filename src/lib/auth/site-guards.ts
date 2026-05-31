import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "./guards";
import { canCreateReceipt } from "./can";

/** Trả user nếu được lập phiếu nhập tại kho này, ngược lại về trang chủ. */
export async function requireReceiptCreator(warehouseId: string) {
  const user = await requireUser();
  const assignments = await db.assignment.findMany({ where: { userId: user.id } });
  if (!canCreateReceipt(user, assignments, warehouseId)) redirect("/");
  return user;
}

/** Danh sách kho mà user được lập phiếu nhập (ADMIN = tất cả kho ACTIVE). */
export async function receivableWarehouses(user: { id: string; companyRole: string | null }) {
  if (user.companyRole === "ADMIN") {
    return db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  }
  const assignments = await db.assignment.findMany({
    where: { userId: user.id, siteRole: "KEEPER" },
    select: { warehouseId: true },
  });
  const ids = assignments.map((a) => a.warehouseId);
  return db.warehouse.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, orderBy: { code: "asc" } });
}

/** Danh sách kho mà user được LẬP ĐỀ NGHỊ XUẤT (ADMIN = tất cả kho ACTIVE; còn lại = kho có vai trò TECHNICIAN). */
export async function issuableWarehouses(user: { id: string; companyRole: string | null }) {
  if (user.companyRole === "ADMIN") {
    return db.warehouse.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  }
  const assignments = await db.assignment.findMany({
    where: { userId: user.id, siteRole: "TECHNICIAN" },
    select: { warehouseId: true },
  });
  const ids = assignments.map((a) => a.warehouseId);
  return db.warehouse.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, orderBy: { code: "asc" } });
}

/** Danh sách id kho mà user được XEM (ADMIN/ACCOUNTANT = tất cả; site user = kho được phân công). */
export async function viewableWarehouseIds(user: { id: string; companyRole: string | null }): Promise<"ALL" | string[]> {
  if (user.companyRole === "ADMIN" || user.companyRole === "ACCOUNTANT") return "ALL";
  const assignments = await db.assignment.findMany({
    where: { userId: user.id },
    select: { warehouseId: true },
  });
  return [...new Set(assignments.map((a) => a.warehouseId))];
}
