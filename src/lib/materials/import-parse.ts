import { validateMaterialInput } from "./validate";

export interface ParsedMaterial {
  code: string;
  name: string;
  unit: string;
  categoryName: string | null;
  modelCode: string | null;
  brandOrigin: string | null;
  specification: string | null;
  latestUnitPrice: number | null;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  items: ParsedMaterial[];
  errors: ParseError[];
}

type RawRow = Record<string, unknown>;

function str(row: RawRow, key: string): string {
  const v = row[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

function optional(row: RawRow, key: string): string | null {
  const v = str(row, key);
  return v === "" ? null : v;
}

function toPrice(row: RawRow): number | null {
  const raw = str(row, "Đơn giá");
  return raw === "" ? null : Number(raw);
}

export function parseMaterialRows(rows: RawRow[]): ParseResult {
  const items: ParsedMaterial[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // dòng 1 là header
    const code = str(row, "Mã");
    const name = str(row, "Tên");
    const unit = str(row, "Đơn vị");
    const price = toPrice(row);

    const v = validateMaterialInput({ code, name, unit, price });
    if (!v.ok) {
      errors.push({ line, message: v.error });
      return;
    }

    items.push({
      code,
      name,
      unit,
      categoryName: optional(row, "Nhóm"),
      modelCode: optional(row, "Mã hiệu"),
      brandOrigin: optional(row, "Nhãn hiệu"),
      specification: optional(row, "Thông số"),
      latestUnitPrice: price,
    });
  });

  return { items, errors };
}
