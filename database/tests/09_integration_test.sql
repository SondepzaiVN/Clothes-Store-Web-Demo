/*
    DECO - Integration test for the agreed main database flows.

    This script intentionally keeps the two test orders and their audit rows
    so they can be inspected in SSMS after the test.
*/

USE DECO;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CustomerID BIGINT =
(
    SELECT TOP (1) UserID
    FROM dbo.Users
    WHERE Role = 'CUSTOMER' AND IsActive = 1
    ORDER BY UserID
);

DECLARE @AdminUserID BIGINT =
(
    SELECT TOP (1) UserID
    FROM dbo.Users
    WHERE Role = 'ADMIN' AND IsActive = 1
    ORDER BY UserID
);

IF @CustomerID IS NULL
    THROW 51000, N'Không có CUSTOMER đang hoạt động để kiểm thử.', 1;

IF @AdminUserID IS NULL
    THROW 51001, N'Không có ADMIN đang hoạt động để kiểm thử.', 1;

DECLARE @VariantID BIGINT;
DECLARE @ProductID BIGINT;
DECLARE @StockBefore INT;
DECLARE @OriginalPrice DECIMAL(18,2);

SELECT TOP (1)
    @VariantID = variant.VariantID,
    @ProductID = product.ProductID,
    @StockBefore = variant.StockQuantity,
    @OriginalPrice = product.Price
FROM dbo.ProductVariants AS variant
INNER JOIN dbo.Products AS product
    ON product.ProductID = variant.ProductID
INNER JOIN dbo.Categories AS category
    ON category.CategoryID = product.CategoryID
INNER JOIN dbo.Sizes AS size
    ON size.SizeID = variant.SizeID
INNER JOIN dbo.Colors AS color
    ON color.ColorID = variant.ColorID
WHERE variant.IsActive = 1
  AND product.IsActive = 1
  AND category.IsActive = 1
  AND size.IsActive = 1
  AND color.IsActive = 1
  AND variant.StockQuantity >= 3
ORDER BY variant.VariantID;

IF @VariantID IS NULL
    THROW 51002, N'Không có biến thể đang bán với tồn kho ít nhất 3.', 1;

DECLARE @VoucherUsedBefore INT =
(
    SELECT UsedCount
    FROM dbo.Vouchers
    WHERE VoucherCode = 'BEST10'
);

IF @VoucherUsedBefore IS NULL
    THROW 51003, N'Không tìm thấy voucher BEST10.', 1;

/* -------------------------------------------------------------------------
   Flow A: COD order -> PREPARING -> SHIPPING -> COMPLETED.
   ------------------------------------------------------------------------- */
DECLARE @CODItems dbo.OrderItemInputType;
INSERT INTO @CODItems (ProductVariantID, Quantity)
VALUES (@VariantID, 1);

DECLARE @CODOrderID BIGINT;
DECLARE @CODOrderCode VARCHAR(30);

EXEC dbo.sp_CreateOrder
    @UserID = @CustomerID,
    @RecipientName = N'Khách kiểm thử COD',
    @RecipientPhone = '0900000001',
    @ShippingAddress = N'Địa chỉ kiểm thử tích hợp - COD',
    @Items = @CODItems,
    @VoucherCode = 'BEST10',
    @PaymentMethod = 'COD',
    @Note = N'Đơn tự động kiểm thử luồng hoàn thành',
    @OrderID = @CODOrderID OUTPUT,
    @OrderCode = @CODOrderCode OUTPUT;

EXEC dbo.sp_UpdateOrderStatus
    @OrderID = @CODOrderID,
    @NewStatus = 'PREPARING',
    @AdminUserID = @AdminUserID,
    @StatusNote = N'Admin bắt đầu chuẩn bị đơn kiểm thử';

EXEC dbo.sp_UpdateOrderStatus
    @OrderID = @CODOrderID,
    @NewStatus = 'SHIPPING',
    @AdminUserID = @AdminUserID,
    @StatusNote = N'Đơn kiểm thử đã giao cho đơn vị vận chuyển';

EXEC dbo.sp_CompleteOrder
    @OrderID = @CODOrderID,
    @AdminUserID = @AdminUserID,
    @ConfirmCODCollected = 1,
    @StatusNote = N'Shipper xác nhận giao hàng và thu COD thành công';

/* -------------------------------------------------------------------------
   Flow B: BANK order -> provider DENIED (twice) -> customer CANCELLED.
   The repeated callback verifies idempotency; cancellation restores stock and
   the voucher usage consumed by this second order.
   ------------------------------------------------------------------------- */
DECLARE @BankItems dbo.OrderItemInputType;
INSERT INTO @BankItems (ProductVariantID, Quantity)
VALUES (@VariantID, 1);

DECLARE @BankOrderID BIGINT;
DECLARE @BankOrderCode VARCHAR(30);

EXEC dbo.sp_CreateOrder
    @UserID = @CustomerID,
    @RecipientName = N'Khách kiểm thử BANK',
    @RecipientPhone = '0900000002',
    @ShippingAddress = N'Địa chỉ kiểm thử tích hợp - BANK',
    @Items = @BankItems,
    @VoucherCode = 'BEST10',
    @PaymentMethod = 'BANK',
    @Note = N'Đơn tự động kiểm thử thanh toán bị từ chối',
    @OrderID = @BankOrderID OUTPUT,
    @OrderCode = @BankOrderCode OUTPUT;

DECLARE @BankPaymentID BIGINT =
(
    SELECT PaymentID
    FROM dbo.Payments
    WHERE OrderID = @BankOrderID
);

DECLARE @TransactionRef VARCHAR(100) =
    'TEST-DENIED-' + REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', '');

EXEC dbo.sp_RecordOnlinePaymentResult
    @PaymentID = @BankPaymentID,
    @TransactionRef = @TransactionRef,
    @ResultStatus = 'DENIED';

-- Same provider callback is accepted without writing a different result.
EXEC dbo.sp_RecordOnlinePaymentResult
    @PaymentID = @BankPaymentID,
    @TransactionRef = @TransactionRef,
    @ResultStatus = 'DENIED';

EXEC dbo.sp_CancelOrder
    @OrderID = @BankOrderID,
    @RequestedByUserID = @CustomerID,
    @StatusNote = N'Khách hủy sau khi thanh toán online bị từ chối';

/* -------------------------------------------------------------------------
   Trigger test: change a price, then restore the original price.
   The product ends with its original price, while two audit rows remain.
   ------------------------------------------------------------------------- */
DECLARE @PriceHistoryBefore INT =
(
    SELECT COUNT(*)
    FROM dbo.ProductPriceHistory
    WHERE ProductID = @ProductID
);

DECLARE @TemporaryPrice DECIMAL(18,2) = @OriginalPrice + 1000;

EXEC dbo.sp_UpdateProductPrice
    @ProductID = @ProductID,
    @NewPrice = @TemporaryPrice,
    @AdminUserID = @AdminUserID;

EXEC dbo.sp_UpdateProductPrice
    @ProductID = @ProductID,
    @NewPrice = @OriginalPrice,
    @AdminUserID = @AdminUserID;

/* -------------------------------------------------------------------------
   Assertions. Any broken invariant raises an error instead of reporting PASS.
   ------------------------------------------------------------------------- */
IF NOT EXISTS
(
    SELECT 1
    FROM dbo.Orders
    WHERE OrderID = @CODOrderID AND Status = 'COMPLETED'
)
    THROW 51010, N'FAIL: đơn COD không ở trạng thái COMPLETED.', 1;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.Payments
    WHERE OrderID = @CODOrderID
      AND PaymentMethod = 'COD'
      AND PaymentStatus = 'PAID'
      AND PaidAt IS NOT NULL
)
    THROW 51011, N'FAIL: thanh toán COD chưa được ghi PAID.', 1;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.Orders
    WHERE OrderID = @BankOrderID AND Status = 'CANCELLED'
)
    THROW 51012, N'FAIL: đơn BANK không ở trạng thái CANCELLED.', 1;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.Payments
    WHERE PaymentID = @BankPaymentID
      AND PaymentMethod = 'BANK'
      AND PaymentStatus = 'DENIED'
      AND TransactionRef = @TransactionRef
)
    THROW 51013, N'FAIL: kết quả thanh toán BANK không được giữ là DENIED.', 1;

IF (SELECT StockQuantity FROM dbo.ProductVariants WHERE VariantID = @VariantID)
   <> @StockBefore - 1
    THROW 51014, N'FAIL: tồn kho cuối không bằng tồn ban đầu trừ đơn đã hoàn thành.', 1;

IF (SELECT UsedCount FROM dbo.Vouchers WHERE VoucherCode = 'BEST10')
   <> @VoucherUsedBefore + 1
    THROW 51015, N'FAIL: lượt dùng voucher không phản ánh đúng một đơn hoàn thành.', 1;

IF (SELECT COUNT(*) FROM dbo.OrderStatusHistory WHERE OrderID = @CODOrderID) <> 4
    THROW 51016, N'FAIL: lịch sử đơn COD phải có đúng 4 mốc.', 1;

IF (SELECT COUNT(*) FROM dbo.OrderStatusHistory WHERE OrderID = @BankOrderID) <> 2
    THROW 51017, N'FAIL: lịch sử đơn BANK bị hủy phải có đúng 2 mốc.', 1;

IF (SELECT Price FROM dbo.Products WHERE ProductID = @ProductID) <> @OriginalPrice
    THROW 51018, N'FAIL: giá sản phẩm chưa được phục hồi.', 1;

IF (SELECT COUNT(*) FROM dbo.ProductPriceHistory WHERE ProductID = @ProductID)
   <> @PriceHistoryBefore + 2
    THROW 51019, N'FAIL: trigger lịch sử giá không tạo đúng 2 dòng.', 1;

IF SESSION_CONTEXT(N'StatusNote') IS NOT NULL
    THROW 51020, N'FAIL: SESSION_CONTEXT StatusNote chưa được dọn sạch.', 1;

/* Compact evidence shown in the final SSMS result grids. */
SELECT
    'PASS' AS TestResult,
    @CODOrderID AS CODOrderID,
    @CODOrderCode AS CODOrderCode,
    @BankOrderID AS BankOrderID,
    @BankOrderCode AS BankOrderCode,
    @VariantID AS TestedVariantID,
    @StockBefore AS StockBefore,
    (SELECT StockQuantity FROM dbo.ProductVariants WHERE VariantID = @VariantID) AS StockAfter;

SELECT
    customerOrder.OrderID,
    customerOrder.OrderCode,
    customerOrder.Status AS OrderStatus,
    customerOrder.TotalAmount,
    payment.PaymentMethod,
    payment.PaymentStatus,
    payment.TransactionRef,
    payment.PaidAt
FROM dbo.Orders AS customerOrder
INNER JOIN dbo.Payments AS payment
    ON payment.OrderID = customerOrder.OrderID
WHERE customerOrder.OrderID IN (@CODOrderID, @BankOrderID)
ORDER BY customerOrder.OrderID;

SELECT
    history.OrderID,
    history.OldStatus,
    history.NewStatus,
    history.ChangedByUserID,
    history.Note,
    history.ChangedAt
FROM dbo.OrderStatusHistory AS history
WHERE history.OrderID IN (@CODOrderID, @BankOrderID)
ORDER BY history.OrderID, history.StatusHistoryID;

SELECT TOP (2)
    PriceHistoryID,
    ProductID,
    OldPrice,
    NewPrice,
    ChangedByUserID,
    ChangedAt
FROM dbo.ProductPriceHistory
WHERE ProductID = @ProductID
ORDER BY PriceHistoryID DESC;
GO
