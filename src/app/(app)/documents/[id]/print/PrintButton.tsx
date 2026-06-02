"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="print:hidden bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">
      In phiếu
    </button>
  );
}
