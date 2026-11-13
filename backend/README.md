# DECO database API

This is a deliberately thin backend. Business operations are implemented by
SQL Server stored procedures; the API validates HTTP input, binds parameters
and returns the procedure result sets.

## Run

```bash
cd backend
copy .env.example .env
npm install
npm start
```

The default configuration connects to the local `DECO` database using the
current Windows account. Check the connection at `GET /api/health`.

## Main routes

| HTTP route | Stored procedure |
|---|---|
| `GET /api/products` | `sp_GetProducts` |
| `GET /api/products/:productId` | `sp_GetProductDetail` |
| `POST /api/orders` | `sp_CreateOrder` |
| `POST /api/orders/:orderId/cancel` | `sp_CancelOrder` |
| `PATCH /api/orders/:orderId/status` | `sp_UpdateOrderStatus` |
| `POST /api/orders/:orderId/complete` | `sp_CompleteOrder` |
| `POST /api/payments/:paymentId/result` | `sp_RecordOnlinePaymentResult` |
| `POST /api/payments/:paymentId/simulate-webhook` | `sp_RecordOnlinePaymentResult` (mô phỏng cổng thanh toán) |
| `PATCH /api/products/:productId/price` | `sp_UpdateProductPrice` |
| `GET /api/users/:userId/orders` | `sp_GetUserOrders` |
| `GET /api/orders/:orderId?requesterUserId=...` | `sp_GetOrderDetail` |
| `GET /api/products/:productId/price-history` | `sp_GetProductPriceHistory` |
| `GET /api/orders/:orderId/status-history?requesterUserId=...` | `sp_GetOrderStatusHistory` |
| `GET /api/admin/orders?adminUserId=...` | `sp_AdminGetOrders` |
| `POST /api/admin/products` | `sp_CreateProduct` |
| `PATCH /api/admin/products/:productId` | `sp_UpdateProduct` |
| `PATCH /api/admin/products/:productId/active` | `sp_SetProductActive` |
| `POST /api/admin/variants` | `sp_UpsertProductVariant` |
| `PATCH /api/admin/variants/:variantId/stock` | `sp_AdjustVariantStock` |

## Cấu trúc mã

- `routes`: khai báo URL và HTTP method.
- `controllers`: nhận request, trả response và chuyển lỗi.
- `services`: gọi stored procedure, không chứa giao diện HTTP.
- `validators`: kiểm tra và chuẩn hóa input.
- `middleware`: xử lý lỗi dùng chung.

Authentication is still a separate project step. The procedures already
enforce active users and admin roles, but a production API must derive user IDs
from a verified session/JWT instead of accepting them from the request body.
