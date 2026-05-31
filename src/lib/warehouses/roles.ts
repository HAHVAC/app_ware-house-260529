export const siteRoleLabel: Record<string, string> = {
  KEEPER: "Thủ kho",
  TECHNICIAN: "Cán bộ kỹ thuật",
  COMMANDER: "Chỉ huy trưởng",
  DEPUTY: "Chỉ huy phó",
};

export const SITE_ROLES = ["KEEPER", "TECHNICIAN", "COMMANDER", "DEPUTY"] as const;
export type SiteRoleInput = (typeof SITE_ROLES)[number];
