import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { ImportForm } from "./form";

export default async function ImportMaterialsPage() {
  await requireAdmin();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Nhập vật tư từ Excel</h1>
      <div className="bg-white rounded-xl shadow p-6 space-y-3 text-sm text-gray-600">
        <p>File <b>.xlsx</b>, dòng đầu là tiêu đề cột. Các cột:</p>
        <p className="font-mono text-xs">Mã | Tên | Đơn vị | Nhóm | Mã hiệu | Nhãn hiệu | Thông số | Đơn giá</p>
        <p>Bắt buộc: <b>Mã, Tên, Đơn vị</b>. Mã đã có sẽ được cập nhật; mã mới sẽ được tạo.</p>
      </div>
      <ImportForm />
      <Link href="/materials" className="inline-block text-sm text-gray-600">← Về danh sách</Link>
    </div>
  );
}
