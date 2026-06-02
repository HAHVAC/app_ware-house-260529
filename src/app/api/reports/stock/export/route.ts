import { getCurrentUser } from "@/lib/auth/current-user";
import { viewableWarehouseIds } from "@/lib/auth/site-guards";
import { getStockReportRows } from "@/lib/reports/stock-report";
import { computeStockValuation } from "@/lib/reports/stock-valuation";
import { stockReportWorkbook } from "@/lib/reports/excel";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const target = new URL(request.url).searchParams.get("w") ?? "all";
  const scope = await viewableWarehouseIds(user);

  // Kiểm phạm vi: nếu chọn 1 kho cụ thể, phải nằm trong phạm vi xem.
  if (target !== "all" && scope !== "ALL" && !scope.includes(target)) {
    return new Response("Forbidden", { status: 403 });
  }

  let title = "Bao cao ton kho - tat ca kho";
  if (target !== "all") {
    const wh = await db.warehouse.findUnique({ where: { id: target }, select: { code: true, name: true } });
    title = `Bao cao ton kho - ${wh ? `${wh.code} ${wh.name}` : target}`;
  }

  const rows = await getStockReportRows(scope, target);
  const report = computeStockValuation(rows);
  const buf = await stockReportWorkbook(title, report);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ton-kho-${stamp}.xlsx"`,
    },
  });
}
