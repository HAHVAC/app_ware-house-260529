import { getCurrentUser } from "@/lib/auth/current-user";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { parseHistoryFilters } from "@/lib/reports/history-filters";
import { getHistoryRows } from "@/lib/reports/history-report";
import { historyWorkbook } from "@/lib/reports/excel";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const p = new URL(request.url).searchParams;
  const filters = parseHistoryFilters({
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    w: p.get("w") ?? undefined,
    m: p.get("m") ?? undefined,
    type: p.get("type") ?? undefined,
  });

  const scope = await viewableWarehouseIds(user);
  if (filters.warehouseId && scope !== "ALL" && !scope.includes(filters.warehouseId)) {
    filters.warehouseId = null;
  }

  const rows = await getHistoryRows(filters, scope);
  const buf = await historyWorkbook(rows);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lich-su-${stamp}.xlsx"`,
    },
  });
}
