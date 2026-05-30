# Thiết kế: Webapp Quản lý Kho (Công ty thi công PCCC & Cơ điện)

- **Ngày:** 2026-05-30
- **Trạng thái:** Đã được người dùng duyệt thiết kế tổng thể (chờ review spec)
- **Phạm vi:** Phiên bản đầu tiên (v1)

---

## 1. Bối cảnh & Mục tiêu

Công ty hoạt động trong lĩnh vực thi công **phòng cháy chữa cháy (PCCC)** và **cơ điện (M&E)**. Hiện việc nhập/xuất kho làm **thủ công** (sổ tay/Excel), nhiều người không cập nhật kịp, dễ sai sót, khó tra cứu lịch sử.

**Mục tiêu v1:** Số hóa quy trình nhập/xuất kho cho nhiều người dùng, giảm sai sót, có lịch sử tra cứu được, và có báo cáo tồn kho.

**Đặc điểm vận hành:**
- Mỗi **công trình** là một **kho riêng**. Chưa có kho tổng (thiết kế để sau thêm được, không phải làm lại).
- Có nhu cầu **điều chuyển vật tư giữa các kho**.
- Theo dõi vật tư **theo số lượng (SKU)**.
- Giao diện **web responsive** (máy tính + điện thoại), **luôn có mạng**, không cần offline.
- Ngôn ngữ: **Tiếng Việt**. Tiền tệ: **VND**.

---

## 2. Kiến trúc & Công nghệ

- **Next.js (App Router) + TypeScript** — một codebase chạy cả giao diện (React) và API (route handlers / server actions).
- **PostgreSQL + Prisma ORM** — lưu trữ dữ liệu, an toàn kiểu, migrate dễ dàng.
- **Tailwind CSS + shadcn/ui** — giao diện responsive cho cả máy tính và điện thoại.
- **Xác thực:** tài khoản nội bộ (username + mật khẩu **mã hóa bằng bcrypt/argon2**), phiên đăng nhập server-side. Phân quyền theo vai trò, **kiểm tra ở phía máy chủ**.
- **PDF:** sinh phiếu nhập/xuất phía máy chủ (HTML → PDF).
- **Excel:** import danh mục vật tư & export báo cáo (thư viện đọc/ghi .xlsx phía máy chủ).

### Nguyên tắc thiết kế
- Mỗi module có một mục đích rõ ràng, giao tiếp qua interface rõ ràng, test độc lập được.
- Logic nghiệp vụ (cập nhật tồn, chuyển trạng thái phiếu) tách thành **lớp service thuần** (pure functions / domain layer) để dễ unit-test, độc lập với framework web.
- File giữ nhỏ, tập trung một trách nhiệm.

---

## 3. Mô hình dữ liệu

### 3.1. `User` — Người dùng
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | khóa chính |
| fullName | string | họ tên |
| username | string | duy nhất, dùng đăng nhập |
| passwordHash | string | mã hóa |
| companyRole | enum: `ADMIN` (Quản lý), `ACCOUNTANT` (Kế toán/Mua hàng) | vai trò cấp công ty; có thể NULL nếu chỉ có vai trò tại kho |
| isActive | boolean | khóa tài khoản |
| createdAt | datetime | |

> Vai trò **tại kho** (Thủ kho, Cán bộ kỹ thuật, Chỉ huy trưởng, Chỉ huy phó) **không** lưu ở đây mà ở bảng `Assignment`.

### 3.2. `Warehouse` — Kho/Công trình
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| code | string | mã kho/công trình, duy nhất |
| name | string | tên công trình |
| type | enum: `PROJECT` (Công trình), `CENTRAL` (Kho tổng — *để dành cho tương lai*) | v1 chỉ tạo `PROJECT` |
| address | string? | địa chỉ công trình |
| status | enum: `ACTIVE` (đang hoạt động), `CLOSED` (đã đóng) | |
| createdAt | datetime | |

### 3.3. `Assignment` — Phân công người dùng ↔ kho
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| userId | fk → User | |
| warehouseId | fk → Warehouse | |
| siteRole | enum: `KEEPER` (Thủ kho), `TECHNICIAN` (Cán bộ kỹ thuật), `COMMANDER` (Chỉ huy trưởng), `DEPUTY` (Chỉ huy phó) | |

- Một người có thể được phân công ở **nhiều công trình**, mỗi nơi một (hoặc nhiều) vai trò.
- Ràng buộc duy nhất: (userId, warehouseId, siteRole).

### 3.4. `Material` — Vật tư
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| code | string | **mã vật tư**, duy nhất (SKU) |
| categoryName | string? | **nhóm vật tư** (text; có thể nâng cấp thành bảng riêng sau) |
| name | string | **tên vật tư** |
| unit | string | **đơn vị tính** (m, cái, bộ, kg...) |
| modelCode | string? | **mã hiệu** |
| brandOrigin | string? | **nhãn hiệu / xuất xứ** |
| specification | string? | **thông số kỹ thuật** |
| latestUnitPrice | decimal? | đơn giá tham khảo mới nhất (VND), cập nhật theo phiếu nhập gần nhất |
| isActive | boolean | |
| createdAt | datetime | |

### 3.5. `Stock` — Tồn kho hiện tại
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| warehouseId | fk → Warehouse | |
| materialId | fk → Material | |
| quantity | decimal | tồn hiện tại; **không bao giờ âm** |

- Ràng buộc **duy nhất (warehouseId, materialId)**.
- Chỉ thay đổi khi phiếu **có hiệu lực** (xem mục 5).

### 3.6. `Document` — Phiếu (chung cho 4 loại)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| code | string | số phiếu, tự sinh theo loại + năm (vd: `PN-2026-0001`, `PX-2026-0001`, `PC-...`, `KK-...`), duy nhất |
| type | enum: `RECEIPT` (Nhập), `ISSUE` (Xuất), `TRANSFER` (Điều chuyển), `ADJUSTMENT` (Kiểm kê/điều chỉnh) | |
| warehouseId | fk → Warehouse | kho chính (kho nguồn với điều chuyển) |
| targetWarehouseId | fk → Warehouse? | kho đích (chỉ với `TRANSFER`) |
| status | enum: `PENDING` (Chờ duyệt), `APPROVED` (Đã duyệt), `REJECTED` (Từ chối), `COMPLETED` (Hoàn thành/Hiệu lực) | |
| createdById | fk → User | người lập |
| approvedById | fk → User? | người duyệt |
| completedById | fk → User? | người hoàn thành (thực xuất) |
| recipient | string? | người nhận (phiếu xuất) |
| reason | string? | lý do (phiếu điều chỉnh) / ghi chú chênh lệch thực xuất |
| note | string? | ghi chú chung |
| createdAt, approvedAt, completedAt | datetime? | mốc thời gian |

### 3.7. `DocumentLine` — Chi tiết phiếu
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| documentId | fk → Document | |
| materialId | fk → Material | |
| requestedQty | decimal | số lượng đề nghị / số trên phiếu |
| actualQty | decimal? | **số thực xuất** (chỉ phiếu xuất, do thủ kho nhập lúc hoàn thành) |
| countedQty | decimal? | **số kiểm kê thực tế** (chỉ phiếu kiểm kê) |
| unitPrice | decimal? | đơn giá tại thời điểm lập (snapshot) |

### 3.8. `Ledger` — Sổ kho (lịch sử biến động)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid | |
| warehouseId | fk → Warehouse | |
| materialId | fk → Material | |
| change | decimal | +/- số lượng |
| balanceAfter | decimal | tồn sau biến động |
| documentId | fk → Document | phiếu gây ra biến động |
| createdAt | datetime | |

- Là nguồn dữ liệu chính cho **lịch sử giao dịch** và đối chiếu tồn.

---

## 4. Vai trò & Phân quyền

### Vai trò cấp công ty
- **Quản lý (`ADMIN`)**: quản lý người dùng, công trình/kho, danh mục vật tư; xem toàn bộ; xuất báo cáo. Truy cập đầy đủ.
- **Kế toán/Mua hàng (`ACCOUNTANT`)**: **chỉ xem** báo cáo tồn kho, giá trị tồn, lịch sử; xuất Excel. Không tạo/sửa phiếu.

### Vai trò tại kho (gán theo từng công trình qua `Assignment`)
- **Cán bộ kỹ thuật (`TECHNICIAN`)**: lập **đề nghị xuất**, lập **điều chuyển**.
- **Chỉ huy trưởng / Chỉ huy phó (`COMMANDER`/`DEPUTY`)**: **duyệt/từ chối** phiếu xuất, điều chuyển (của kho nguồn), kiểm kê.
- **Thủ kho (`KEEPER`)**: lập **phiếu nhập** (hiệu lực ngay); ghi **thực xuất** + hoàn thành phiếu xuất đã duyệt; lập **phiếu kiểm kê/điều chỉnh**.

### Ma trận hành động
| Hành động | Vai trò được phép |
|---|---|
| Quản lý người dùng / công trình / danh mục vật tư | ADMIN |
| Xem báo cáo, xuất Excel | ADMIN, ACCOUNTANT (toàn bộ); vai trò tại kho (xem kho được phân công) |
| Lập phiếu nhập | KEEPER (của kho đó) |
| Lập đề nghị xuất, lập điều chuyển | TECHNICIAN (của kho nguồn) |
| Duyệt/từ chối xuất, điều chuyển, kiểm kê | COMMANDER/DEPUTY (của kho nguồn) |
| Ghi thực xuất + hoàn thành phiếu xuất | KEEPER (của kho đó) |
| Lập kiểm kê/điều chỉnh | KEEPER (của kho đó) |

> **Mọi kiểm tra phân quyền thực hiện ở phía máy chủ.** Ẩn/hiện nút trên giao diện chỉ là phụ trợ.

---

## 5. Luồng trạng thái phiếu & Thời điểm tồn thay đổi

### 5.1. NHẬP (`RECEIPT`)
1. Thủ kho lập phiếu (vật tư, số lượng, đơn giá, ghi chú).
2. Phiếu **hiệu lực ngay** → status = `COMPLETED`.
3. Tác động: tồn **+ requestedQty** cho mỗi dòng; ghi `Ledger`; cập nhật `Material.latestUnitPrice` theo đơn giá phiếu.
- *Phiếu nhập không cần thông tin nhà cung cấp/chứng từ (chỉ ghi chú nếu cần).*

### 5.2. XUẤT (`ISSUE`) — 3 bước
1. **Cán bộ kỹ thuật** lập đề nghị xuất (requestedQty) → `PENDING`.
2. **Chỉ huy trưởng/phó** duyệt → `APPROVED`, hoặc từ chối → `REJECTED`.
3. **Thủ kho** ghi **actualQty** (số thực xuất) → `COMPLETED`.
   - actualQty **có thể khác** requestedQty (ít hơn **hoặc nhiều hơn**), miễn **còn đủ tồn**.
   - Nếu actualQty ≠ requestedQty → **bắt buộc ghi chú lý do chênh lệch** (`reason`).
   - Tác động (tại bước hoàn thành): tồn **− actualQty**; ghi `Ledger`. **Kiểm tra đủ tồn, không cho âm.**

### 5.3. ĐIỀU CHUYỂN (`TRANSFER`)
1. **Cán bộ kỹ thuật** (kho nguồn) lập phiếu (kho nguồn → kho đích, số lượng) → `PENDING`.
2. **Chỉ huy trưởng/phó của kho nguồn** duyệt → `COMPLETED`. (Từ chối → `REJECTED`.)
   - Tác động ngay khi duyệt: tồn nguồn **−**, tồn đích **+**; ghi `Ledger` (2 dòng). **Kiểm tra đủ tồn kho nguồn.**
   - *Không có bước xác nhận nhận hàng riêng ở kho đích.*

### 5.4. KIỂM KÊ / ĐIỀU CHỈNH (`ADJUSTMENT`)
1. **Thủ kho** lập phiếu kiểm kê với **countedQty** (số đếm thực tế) cho từng vật tư → `PENDING`.
2. **Chỉ huy trưởng/phó** duyệt → `COMPLETED`. (Từ chối → `REJECTED`.)
   - Tác động: tồn được **đặt = countedQty**; chênh lệch (countedQty − tồn cũ) ghi vào `Ledger` (có thể + hoặc −).

---

## 6. Quy tắc nghiệp vụ & Xử lý lỗi

- **Không cho tồn âm:** kiểm tra tại mọi bước trừ tồn (hoàn thành xuất, duyệt điều chuyển). Thiếu tồn → báo lỗi rõ ràng, **không** cho hoàn thành/duyệt.
- **Tính nguyên tử (atomic):** cập nhật `Stock` + ghi `Ledger` (+ cập nhật `Document`) luôn chạy trong **một transaction DB** → không sai lệch khi nhiều người thao tác đồng thời.
- **Khóa phiếu hiệu lực:** phiếu ở trạng thái `COMPLETED` (và biến động tồn đã ghi) **không được sửa/xóa**. Sửa sai bằng cách lập **phiếu kiểm kê/điều chỉnh**. Phiếu `PENDING` có thể bị người lập hủy/sửa trước khi duyệt.
- **Validation:** số lượng > 0; đơn giá ≥ 0; mã vật tư & mã kho duy nhất; kho nguồn ≠ kho đích (điều chuyển); thực xuất ≠ số duyệt → bắt buộc lý do.
- **Số phiếu** tự sinh, duy nhất theo loại + năm.

---

## 7. Các màn hình chính

1. **Đăng nhập.**
2. **Trang tổng quan:** phiếu chờ duyệt (theo vai trò), phiếu xuất đã duyệt chờ thủ kho hoàn thành, vài số liệu nhanh.
3. **Danh mục vật tư:** danh sách, thêm/sửa, **import từ Excel**.
4. **Công trình/Kho:** danh sách, thêm/sửa, **gán nhân sự** (4 vai trò tại kho).
5. **Người dùng** (ADMIN): tạo tài khoản, đặt vai trò công ty, kích hoạt/khóa.
6. **Nhập kho** · **Đề nghị xuất** · **Điều chuyển** · **Kiểm kê/điều chỉnh** — form nhiều dòng vật tư.
7. **Duyệt phiếu** (chỉ huy): danh sách chờ, duyệt/từ chối.
8. **Hoàn thành xuất** (thủ kho): nhập số thực xuất + lý do chênh lệch.
9. **Báo cáo tồn kho:** theo từng kho và tổng hợp tất cả kho, kèm giá trị tồn (≈ tồn × đơn giá tham khảo); **xuất Excel**.
10. **Lịch sử giao dịch:** lọc theo thời gian/kho/vật tư/loại phiếu/người thực hiện; **xuất Excel**.
11. **In phiếu PDF:** phiếu nhập/xuất (có chỗ ký).

---

## 8. Triển khai (Cloud, dễ vận hành)

- **Khuyến nghị:** nền tảng PaaS tự build từ Git (Render/Railway) + **PostgreSQL quản lý sẵn có tự sao lưu** (Neon hoặc tương đương). Tự cấp HTTPS, gắn tên miền dễ. Chi phí khởi điểm rất thấp (~0–15 USD/tháng cho quy mô nhỏ).
- **Nếu yêu cầu dữ liệu đặt tại Việt Nam:** dùng VPS trong nước (Viettel/FPT/VNG); điều chỉnh hướng dẫn triển khai tương ứng. *(Quyết định sau, không chặn việc lập trình.)*
- **Sao lưu:** bật sao lưu tự động hằng ngày cho database.

---

## 9. Kiểm thử (theo TDD)

Viết **test trước** khi viết code cho phần lõi:
- **Logic tồn kho & chuyển trạng thái** (đơn vị, ưu tiên cao nhất): nhập tăng tồn; xuất trừ đúng `actualQty`; chặn tồn âm; điều chuyển trừ nguồn/cộng đích; kiểm kê đặt tồn = `countedQty`; `Ledger` ghi đúng `change` và `balanceAfter`.
- **Luồng duyệt nhiều bước** (tích hợp): đúng thứ tự trạng thái, đúng người được phép ở mỗi bước.
- **Phân quyền** (tích hợp): chặn hành động sai vai trò / sai kho ở phía máy chủ.

---

## 10. Ngoài phạm vi v1 (YAGNI — để sau)

- Kho tổng (`CENTRAL`) — mô hình đã chừa sẵn, chưa làm chức năng.
- Cảnh báo/mức tồn tối thiểu sắp hết hàng.
- Quét mã vạch/QR.
- Theo dõi theo lô/serial; tính giá bình quân gia quyền.
- Sử dụng offline.
- Bước xác nhận nhận hàng ở kho đích khi điều chuyển.
