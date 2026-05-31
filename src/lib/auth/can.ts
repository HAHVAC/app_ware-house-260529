import type { CompanyRole, SiteRole } from "@prisma/client";

/** Quyết định ai được lập phiếu nhập: ADMIN, hoặc KEEPER của chính kho đó. */
export function canCreateReceipt(
  user: { companyRole: CompanyRole | null },
  assignments: { warehouseId: string; siteRole: SiteRole }[],
  warehouseId: string,
): boolean {
  if (user.companyRole === "ADMIN") return true;
  return assignments.some((a) => a.warehouseId === warehouseId && a.siteRole === "KEEPER");
}
