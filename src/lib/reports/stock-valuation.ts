export interface StockValuationInput {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
}

export interface StockValuationLine extends StockValuationInput {
  value: number | null;
}

export interface StockValuationResult {
  lines: StockValuationLine[];
  totalValue: number;
  missingPriceCount: number;
}

/** Tính giá trị tồn (thuần): value = tồn × đơn giá; thiếu giá → null, không cộng tổng. */
export function computeStockValuation(rows: StockValuationInput[]): StockValuationResult {
  let totalValue = 0;
  let missingPriceCount = 0;
  const lines: StockValuationLine[] = rows.map((r) => {
    if (r.unitPrice == null) {
      missingPriceCount++;
      return { ...r, value: null };
    }
    const value = r.quantity * r.unitPrice;
    totalValue += value;
    return { ...r, value };
  });
  return { lines, totalValue, missingPriceCount };
}
