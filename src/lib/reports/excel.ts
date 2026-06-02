import ExcelJS from "exceljs";
import type { StockValuationResult } from "./stock-valuation";
import type { HistoryRow } from "./history-report";

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Nhập", ISSUE: "Xuất", TRANSFER: "Điều chuyển", ADJUSTMENT: "Kiểm kê",
};

export async function stockReportWorkbook(
  title: string,
  data: StockValuationResult,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ton kho");
  ws.addRow([title]);
  ws.addRow([]);
  ws.addRow(["Mã VT", "Tên", "ĐVT", "Tồn", "Đơn giá", "Giá trị"]);
  for (const l of data.lines) {
    ws.addRow([l.code, l.name, l.unit, l.quantity, l.unitPrice ?? "", l.value ?? ""]);
  }
  ws.addRow([]);
  ws.addRow(["", "", "", "", "TỔNG GIÁ TRỊ", data.totalValue]);
  if (data.missingPriceCount > 0) {
    ws.addRow([`(${data.missingPriceCount} vật tư chưa có đơn giá, không tính vào tổng)`]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function historyWorkbook(rows: HistoryRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lich su");
  ws.addRow(["Ngày", "Kho", "Mã VT", "Tên VT", "ĐVT", "Loại phiếu", "Biến động", "Tồn sau", "Số phiếu", "Người lập"]);
  for (const r of rows) {
    ws.addRow([
      r.date.toLocaleString("vi-VN"),
      `${r.warehouseCode} — ${r.warehouseName}`,
      r.materialCode, r.materialName, r.unit,
      TYPE_LABEL[r.type] ?? r.type,
      r.change, r.balanceAfter, r.documentCode, r.createdByName,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
