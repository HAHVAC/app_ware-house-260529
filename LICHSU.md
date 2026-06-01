# Lịch sử phát triển — Webapp Quản lý Kho (PCCC & Cơ điện)

> File này ghi lại quá trình xây dựng phần mềm theo từng **Kế hoạch (KH)**.
> Mỗi KH là một nhóm tính năng hoàn chỉnh, được lập kế hoạch → làm → kiểm thử → gộp vào bản chính.
>
> **Ngày cập nhật gần nhất:** 31/05/2026

---

## Tổng quan dự án

Phần mềm quản lý kho vật tư cho công ty thi công **phòng cháy chữa cháy (PCCC)** và **cơ điện (M&E)**.

**Mô hình:** mỗi **công trình = một kho riêng**. Theo dõi vật tư theo số lượng tồn (theo mã vật tư). Web chạy trực tuyến, dùng được trên điện thoại và máy tính. Ngôn ngữ tiếng Việt, tiền tệ VND.

**Công nghệ:** Next.js 16 + Prisma v7 + PostgreSQL. Triển khai trên nền tảng đám mây.

**Tài liệu thiết kế chi tiết:** [docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md](docs/superpowers/specs/2026-05-30-warehouse-management-webapp-design.md)

---

## Lộ trình 6 kế hoạch

| KH | Nội dung | Trạng thái |
|----|----------|------------|
| **KH1** | Nền tảng & Đăng nhập | ✅ Hoàn thành |
| **KH2a** | Quản lý người dùng | ✅ Hoàn thành |
| **KH2b** | Công trình/Kho + Phân công nhân sự | ✅ Hoàn thành |
| **KH2c** | Danh mục vật tư + Nhập từ Excel | ✅ Hoàn thành |
| **KH3** | Lõi tồn kho + Nhập kho | ✅ Hoàn thành |
| **KH4** | Xuất kho (quy trình 3 bước) | ✅ Hoàn thành (đã gộp master) |
| **KH5** | Điều chuyển giữa kho + Kiểm kê | ✅ Hoàn thành (đã gộp master) |
| **KH6** | Báo cáo + Xuất Excel/PDF | ⏳ Chưa làm |

---

## KH1 — Nền tảng & Đăng nhập ✅

Dựng bộ khung dự án và hệ thống đăng nhập an toàn.

- Khởi tạo dự án Next.js + Tailwind (giao diện) + Vitest (kiểm thử tự động).
- Kết nối cơ sở dữ liệu PostgreSQL qua Prisma; tạo bảng **Người dùng**.
- Mã hóa mật khẩu an toàn (bcrypt), dịch vụ xác thực đăng nhập.
- Phiên đăng nhập bảo mật (iron-session), tự hết hạn sau 8 giờ.
- Trang đăng nhập, đăng xuất, bảo vệ toàn bộ trang nội bộ (chưa đăng nhập thì không vào được).
- Tạo sẵn tài khoản Quản lý (admin) ban đầu.
- Chống trùng tên đăng nhập.

## KH2a — Quản lý người dùng ✅

- Phân quyền: chỉ Quản lý (admin) mới vào được khu quản trị.
- Kiểm tra dữ liệu người dùng trước khi lưu.
- Tạo / sửa người dùng; danh sách người dùng.
- Chống tự hạ quyền hoặc tự khóa tài khoản admin; báo lỗi rõ khi trùng tên đăng nhập.

## KH2b — Công trình/Kho + Phân công nhân sự ✅

- Tạo bảng **Công trình/Kho** và bảng **Phân công** (gán người vào kho theo vai trò).
- Vai trò tại kho: Chỉ huy trưởng, Chỉ huy phó, Cán bộ kỹ thuật, Thủ kho.
- Tạo / sửa công trình; danh sách công trình.
- Phân công / gỡ phân công nhân sự cho từng kho.
- Xử lý các lỗi gỡ/gán phân công không hợp lệ.

## KH2c — Danh mục vật tư + Nhập từ Excel ✅

- Tạo bảng **Vật tư** (mã, tên, đơn vị tính…).
- Tạo / sửa vật tư; danh sách vật tư.
- **Nhập hàng loạt từ file Excel:** đọc file, kiểm tra dữ liệu, khử trùng mã trong file, báo lỗi từng dòng.
- Nâng giới hạn dung lượng tải lên để nhập được file lớn.

## KH3 — Lõi tồn kho + Nhập kho ✅

Đây là phần lõi của quản lý kho.

- Tạo các bảng: **Tồn kho** (số lượng theo từng kho), **Phiếu**, **Dòng phiếu**, **Sổ kho** (lịch sử mọi biến động).
- Logic tính tồn khi nhập kho (có kiểm thử tự động).
- Sinh **số phiếu nhập** tự động dạng `PN-2026-0001`.
- Phân quyền lập phiếu nhập (Quản lý hoặc Thủ kho của kho đó).
- Lập phiếu nhập kho (một phiếu nhiều dòng vật tư), chạy trong giao dịch an toàn.
- Danh sách + chi tiết phiếu nhập; trang xem tồn kho.
- **Quy tắc:** phiếu nhập có hiệu lực ngay, không sửa/xóa được (sai sót xử lý bằng kiểm kê — kế hoạch sau).

## KH4 — Xuất kho (quy trình 3 bước) ✅

Quy trình xuất kho qua **3 bước, 3 vai trò** để kiểm soát chặt:

1. **Lập đề nghị** — Cán bộ kỹ thuật (hoặc Quản lý) tạo đề nghị xuất → trạng thái *Chờ duyệt*.
2. **Duyệt / Từ chối** — Chỉ huy trưởng/phó (hoặc Quản lý) duyệt → *Đã duyệt*, hoặc từ chối (kèm lý do).
3. **Ghi thực xuất** — Thủ kho (hoặc Quản lý) ghi số lượng thực tế xuất → *Đã xuất*, trừ tồn kho.

Đã làm:

- Logic trừ tồn khi xuất + kiểm tra không cho tồn âm (kiểm thử tự động).
- Kiểm tra dữ liệu đề nghị xuất và bước thực xuất (bắt buộc nhập lý do nếu thực xuất khác đề nghị).
- Phân quyền 3 bước, **cấm tự duyệt** (người lập không được tự duyệt phiếu của mình).
- 6 thao tác máy chủ: lập / sửa / hủy / duyệt / từ chối / thực xuất.
- Giao diện: danh sách, form lập-sửa, chi tiết phiếu (kèm các nút theo vai trò), trang ghi thực xuất.
- Sinh **số phiếu xuất** tự động dạng `PX-2026-0001`.
- Trừ tồn an toàn (không cho tồn âm kể cả khi nhiều người thao tác cùng lúc).

Đã gộp vào `master` và đẩy lên GitHub (31/05/2026). Khuyến nghị kiểm thử kỹ trên trình duyệt khi vận hành thực tế.

## KH5 — Điều chuyển giữa kho + Kiểm kê ✅

Đã hoàn thành & gộp vào `master` (01/06/2026); test tự động 123 pass, build production OK, đã qua review tổng thể. Gồm 2 tính năng (không đổi cấu trúc dữ liệu):

- **Điều chuyển kho** (số phiếu `PDC-2026-xxxx`, 2 bước): Cán bộ kỹ thuật kho nguồn lập (kho nguồn → kho đích) → Chỉ huy kho nguồn duyệt = trừ tồn nguồn, cộng tồn đích ngay (ghi sổ 2 dòng). Cấm tự duyệt, không cho tồn âm.
- **Kiểm kê / Điều chỉnh** (số phiếu `PKK-2026-xxxx`, 2 bước): Thủ kho lập, màn hình tự nạp sẵn toàn bộ tồn để gõ số đếm thực tế (cho thêm vật tư mới) → Chỉ huy duyệt = đặt tồn bằng số đếm, ghi chênh lệch vào sổ.

## KH6 — Báo cáo + Xuất Excel/PDF ⏳

(Chưa làm) Báo cáo tồn kho, nhập–xuất–tồn theo kỳ; xuất file Excel/PDF.

---

## Ghi chú vận hành

- **Tài khoản & mật khẩu cơ sở dữ liệu** không lưu trong mã nguồn (đặt trong file `.env`, không đẩy lên GitHub).
- Mã nguồn lưu tại GitHub: `https://github.com/HAHVAC/app_ware-house-260529.git`
- Chi tiết kế hoạch từng KH nằm trong thư mục [docs/superpowers/plans/](docs/superpowers/plans/).
