"use client";

import { useActionState } from "react";
import { approveTransferAction, type TransferFormState } from "@/lib/inventory/transfer-actions";

const initial: TransferFormState = {};

export function ApproveTransferButton({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(approveTransferAction, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={documentId} />
      <button type="submit" disabled={pending} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
        {pending ? "Đang chuyển..." : "Duyệt & chuyển"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
