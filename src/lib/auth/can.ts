import type { CompanyRole, SiteRole, DocumentStatus } from "@prisma/client";

/** Quyết định ai được lập phiếu nhập: ADMIN, hoặc KEEPER của chính kho đó. */
export function canCreateReceipt(
  user: { companyRole: CompanyRole | null },
  assignments: { warehouseId: string; siteRole: SiteRole }[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return assignments.some((a) => a.warehouseId === warehouseId && a.siteRole === "KEEPER");
}

type Assignment = { warehouseId: string; siteRole: SiteRole };

function hasRoleAt(assignments: Assignment[], warehouseId: string, roles: SiteRole[]): boolean {
  return assignments.some((a) => a.warehouseId === warehouseId && roles.includes(a.siteRole));
}

/** Lập đề nghị xuất: ADMIN hoặc TECHNICIAN của kho. */
export function canCreateIssue(
  user: { companyRole: CompanyRole | null },
  assignments: Assignment[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, warehouseId, ["TECHNICIAN"]);
}

/** Duyệt/từ chối xuất: (ADMIN hoặc COMMANDER/DEPUTY của kho) VÀ không phải người lập. */
export function canApproveIssue(
  user: { id: string; companyRole: CompanyRole | null },
  assignments: Assignment[],
  warehouseId: string,
  createdById: string,
): boolean {
  if (user.id === createdById) return false;
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, warehouseId, ["COMMANDER", "DEPUTY"]);
}

/** Ghi thực xuất: ADMIN hoặc KEEPER của kho. */
export function canCompleteIssue(
  user: { companyRole: CompanyRole | null },
  assignments: Assignment[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return hasRoleAt(assignments, warehouseId, ["KEEPER"]);
}

/** Sửa/hủy phiếu đang chờ duyệt: phải PENDING, và là người lập hoặc ADMIN. */
export function canModifyPendingIssue(
  user: { id: string; companyRole: CompanyRole | null },
  doc: { status: DocumentStatus; createdById: string },
): boolean {
  if (doc.status !== "PENDING") return false;
  return user.companyRole === "ADMIN" || user.id === doc.createdById;
}
