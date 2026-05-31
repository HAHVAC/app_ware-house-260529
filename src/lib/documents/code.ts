import type { DocumentType } from "@prisma/client";

const PREFIX: Record<DocumentType, string> = {
  RECEIPT: "PN",
  ISSUE: "PX",
  TRANSFER: "PC",
  ADJUSTMENT: "KK",
};

export function documentCodePrefix(type: DocumentType): string {
  return PREFIX[type];
}

export function formatDocumentCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
