# DECO database scripts

Thư mục này là **nguồn chính thức** của phần SQL Server. Script được phân theo
mục đích, nhưng khi dựng database mới vẫn phải chạy theo thứ tự số tăng dần.

## Nhóm triển khai bắt buộc

| Thứ tự | File | Vai trò |
|---:|---|---|
| 01 | `deploy/01_schema.sql` | Tạo 14 bảng, khóa, constraint và index |
| 02 | `seeds/02_seed_master_data.sql` | Người dùng, danh mục, size, màu, sản phẩm, biến thể, voucher |
| 03 | `deploy/03_table_types.sql` | TVP `OrderItemInputType` cho giỏ hàng truyền vào đặt hàng |
| 04 | `deploy/04_read_procedures.sql` | Procedure đọc catalog, đơn hàng, lookup và danh sách đơn admin |
| 05 | `deploy/05_write_procedures.sql` | Procedure cập nhật giá/trạng thái và quản trị sản phẩm, biến thể, tồn kho |
| 06 | `deploy/06_transaction_procedures.sql` | 4 transaction procedure chính |
| 07 | `deploy/07_triggers.sql` | 2 trigger audit |
| 08 | `seeds/08_seed_transaction_data.sql` | 5 đơn demo ở các trạng thái chính |
| 12 | `deploy/12_ai_search.sql` | Bảng vector và procedure hybrid semantic search |

## Nhóm kiểm thử và minh chứng

| Thứ tự | File | Vai trò |
|---:|---|---|
| 09 | `tests/09_integration_test.sql` | Kiểm tra xuyên suốt COD, BANK, tồn kho, voucher và audit |
| 10 | `tests/10_rollback_tests.sql` | Kiểm tra trường hợp lỗi và rollback |
| 11 | `tests/11_index_evidence.sql` | `STATISTICS IO/TIME` và minh chứng Index Seek |
| 13 | `tests/13_ai_search_test.sql` | Kiểm tra số sản phẩm đã index và procedure semantic search |

`deploy` chứa cấu trúc và logic database; `seeds` chứa dữ liệu mẫu; `tests` chỉ
chứa kiểm thử và minh chứng. Các file 01–08 tạo cấu trúc/chức năng/dữ liệu của ứng dụng. Các file 09–11 có
thể chạy lại để lấy ảnh và số liệu cho báo cáo. `schema.dbml` dùng để hiển thị
ERD trên dbdiagram.io. File 12 là mô-đun AI bổ sung sau khi phần database cốt
lõi đã ổn định. Sau khi chạy file 12, khởi động `ai-service` và chạy
`npm run ai:reindex` trong `backend` để sinh embedding cho dữ liệu hiện có.

Các bản trong `D:\DBMS\task` là bản làm việc của nhóm; khi có thay đổi đã duyệt,
cần cập nhật lại bản chính thức tại thư mục này.
