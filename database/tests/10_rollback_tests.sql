/*
    DECO - Negative-path and rollback verification.

    Expected failures are caught and reported as PASS. The script verifies that
    stock, orders and voucher counters are unchanged after rejected operations.
*/

USE DECO;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Results TABLE
(
    TestName NVARCHAR(100) NOT NULL,
    Result VARCHAR(10) NOT NULL,
    ErrorNumber INT NULL,
    Detail NVARCHAR(500) NULL
);

DECLARE @CustomerID BIGINT =
(
    SELECT TOP (1) UserID FROM dbo.Users
    WHERE Role = 'CUSTOMER' AND IsActive = 1 ORDER BY UserID
);

DECLARE @AdminUserID BIGINT =
(
    SELECT TOP (1) UserID FROM dbo.Users
    WHERE Role = 'ADMIN' AND IsActive = 1 ORDER BY UserID
);

DECLARE @VariantID BIGINT;
DECLARE @StockBefore INT;

SELECT TOP (1)
    @VariantID = VariantID,
    @StockBefore = StockQuantity
FROM dbo.ProductVariants
WHERE IsActive = 1 AND StockQuantity > 0
ORDER BY StockQuantity DESC, VariantID;

IF @CustomerID IS NULL OR @AdminUserID IS NULL OR @VariantID IS NULL
    THROW 51150, N'Thiếu CUSTOMER, ADMIN hoặc biến thể có tồn kho để kiểm thử.', 1;

DECLARE @OrderCountBefore BIGINT = (SELECT COUNT_BIG(*) FROM dbo.Orders);
DECLARE @VoucherUsedBefore INT =
    (SELECT UsedCount FROM dbo.Vouchers WHERE VoucherCode = 'BEST10');

/* Test 1: overselling must be rejected and must not reduce stock. */
BEGIN TRY
    DECLARE @OversellItems dbo.OrderItemInputType;
    INSERT INTO @OversellItems VALUES (@VariantID, @StockBefore + 1);
    DECLARE @UnexpectedOrderID1 BIGINT, @UnexpectedCode1 VARCHAR(30);

    EXEC dbo.sp_CreateOrder
        @UserID = @CustomerID,
        @RecipientName = N'Rollback Oversell',
        @RecipientPhone = '0902000001',
        @ShippingAddress = N'Địa chỉ rollback oversell',
        @Items = @OversellItems,
        @VoucherCode = 'BEST10',
        @PaymentMethod = 'COD',
        @OrderID = @UnexpectedOrderID1 OUTPUT,
        @OrderCode = @UnexpectedCode1 OUTPUT;

    INSERT INTO @Results VALUES
        (N'Không bán vượt tồn kho', 'FAIL', NULL, N'Procedure đã tạo đơn ngoài dự kiến.');
END TRY
BEGIN CATCH
    INSERT INTO @Results VALUES
    (
        N'Không bán vượt tồn kho',
        CASE WHEN ERROR_NUMBER() = 50207 THEN 'PASS' ELSE 'FAIL' END,
        ERROR_NUMBER(), ERROR_MESSAGE()
    );
END CATCH;

/* Test 2: an unknown voucher must roll back the entire create-order flow. */
BEGIN TRY
    DECLARE @BadVoucherItems dbo.OrderItemInputType;
    INSERT INTO @BadVoucherItems VALUES (@VariantID, 1);
    DECLARE @UnexpectedOrderID2 BIGINT, @UnexpectedCode2 VARCHAR(30);

    EXEC dbo.sp_CreateOrder
        @UserID = @CustomerID,
        @RecipientName = N'Rollback Voucher',
        @RecipientPhone = '0902000002',
        @ShippingAddress = N'Địa chỉ rollback voucher',
        @Items = @BadVoucherItems,
        @VoucherCode = 'VOUCHER-KHONG-TON-TAI',
        @PaymentMethod = 'COD',
        @OrderID = @UnexpectedOrderID2 OUTPUT,
        @OrderCode = @UnexpectedCode2 OUTPUT;

    INSERT INTO @Results VALUES
        (N'Voucher không tồn tại', 'FAIL', NULL, N'Procedure đã tạo đơn ngoài dự kiến.');
END TRY
BEGIN CATCH
    INSERT INTO @Results VALUES
    (
        N'Voucher không tồn tại',
        CASE WHEN ERROR_NUMBER() = 50208 THEN 'PASS' ELSE 'FAIL' END,
        ERROR_NUMBER(), ERROR_MESSAGE()
    );
END CATCH;

/* Test 3: PENDING cannot jump directly to SHIPPING. */
DECLARE @PendingOrderID BIGINT =
(
    SELECT TOP (1) OrderID
    FROM dbo.Orders
    WHERE Status = 'PENDING'
    ORDER BY OrderID
);

IF @PendingOrderID IS NULL
BEGIN
    INSERT INTO @Results VALUES
        (N'Không nhảy trạng thái PENDING -> SHIPPING', 'FAIL', NULL,
         N'Cần chạy 09_seed_transaction_data.sql trước để có đơn PENDING.');
END
ELSE
BEGIN
    BEGIN TRY
        EXEC dbo.sp_UpdateOrderStatus
            @OrderID = @PendingOrderID,
            @NewStatus = 'SHIPPING',
            @AdminUserID = @AdminUserID,
            @StatusNote = N'Thử nhảy sai trạng thái';

        INSERT INTO @Results VALUES
            (N'Không nhảy trạng thái PENDING -> SHIPPING', 'FAIL', NULL,
             N'Procedure đã cho phép chuyển sai trạng thái.');
    END TRY
    BEGIN CATCH
        INSERT INTO @Results VALUES
        (
            N'Không nhảy trạng thái PENDING -> SHIPPING',
            CASE WHEN ERROR_NUMBER() = 50113 THEN 'PASS' ELSE 'FAIL' END,
            ERROR_NUMBER(), ERROR_MESSAGE()
        );
    END CATCH;
END;

/* Test 4: a SHIPPING COD order cannot complete without COD confirmation. */
DECLARE @ShippingOrderID BIGINT =
(
    SELECT TOP (1) customerOrder.OrderID
    FROM dbo.Orders AS customerOrder
    INNER JOIN dbo.Payments AS payment ON payment.OrderID = customerOrder.OrderID
    WHERE customerOrder.Status = 'SHIPPING'
      AND payment.PaymentMethod = 'COD'
      AND payment.PaymentStatus = 'PENDING'
    ORDER BY customerOrder.OrderID
);

IF @ShippingOrderID IS NULL
BEGIN
    INSERT INTO @Results VALUES
        (N'COD cần xác nhận đã thu tiền', 'FAIL', NULL,
         N'Cần chạy 09_seed_transaction_data.sql trước để có đơn SHIPPING COD.');
END
ELSE
BEGIN
    BEGIN TRY
        EXEC dbo.sp_CompleteOrder
            @OrderID = @ShippingOrderID,
            @AdminUserID = @AdminUserID,
            @ConfirmCODCollected = 0;

        INSERT INTO @Results VALUES
            (N'COD cần xác nhận đã thu tiền', 'FAIL', NULL,
             N'Procedure đã hoàn thành COD mà không xác nhận thu tiền.');
    END TRY
    BEGIN CATCH
        INSERT INTO @Results VALUES
        (
            N'COD cần xác nhận đã thu tiền',
            CASE WHEN ERROR_NUMBER() = 50246 THEN 'PASS' ELSE 'FAIL' END,
            ERROR_NUMBER(), ERROR_MESSAGE()
        );
    END CATCH;
END;

/* Test 5: a PAID order cannot be cancelled without a refund workflow.
   An outer transaction makes the setup order temporary. sp_CancelOrder rolls
   it all back when it rejects the cancellation. */
DECLARE @PaidTestOrderID BIGINT;
DECLARE @PaidTestOrderCode VARCHAR(30);

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @PaidItems dbo.OrderItemInputType;
    INSERT INTO @PaidItems VALUES (@VariantID, 1);

    EXEC dbo.sp_CreateOrder
        @UserID = @CustomerID,
        @RecipientName = N'Rollback Paid Cancel',
        @RecipientPhone = '0902000003',
        @ShippingAddress = N'Địa chỉ rollback paid cancel',
        @Items = @PaidItems,
        @PaymentMethod = 'BANK',
        @Note = N'[TEMP:ROLLBACK:PAID_CANCEL]',
        @OrderID = @PaidTestOrderID OUTPUT,
        @OrderCode = @PaidTestOrderCode OUTPUT;

    DECLARE @PaidTestPaymentID BIGINT =
        (SELECT PaymentID FROM dbo.Payments WHERE OrderID = @PaidTestOrderID);
    DECLARE @PaidTestRef VARCHAR(100) =
        'TEMP-PAID-' + CONVERT(VARCHAR(20), @PaidTestPaymentID);

    EXEC dbo.sp_RecordOnlinePaymentResult
        @PaymentID = @PaidTestPaymentID,
        @TransactionRef = @PaidTestRef,
        @ResultStatus = 'PAID';

    EXEC dbo.sp_CancelOrder
        @OrderID = @PaidTestOrderID,
        @RequestedByUserID = @CustomerID,
        @StatusNote = N'Thử hủy đơn đã thanh toán';

    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    INSERT INTO @Results VALUES
        (N'Không hủy đơn đã PAID', 'FAIL', NULL,
         N'Procedure đã cho phép hủy đơn PAID.');
END TRY
BEGIN CATCH
    DECLARE @PaidCancelError INT = ERROR_NUMBER();
    DECLARE @PaidCancelMessage NVARCHAR(500) = ERROR_MESSAGE();
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

    INSERT INTO @Results VALUES
    (
        N'Không hủy đơn đã PAID',
        CASE WHEN @PaidCancelError = 50225 THEN 'PASS' ELSE 'FAIL' END,
        @PaidCancelError, @PaidCancelMessage
    );
END CATCH;

/* Cross-test invariants: rejected actions must leave no partial changes. */
IF (SELECT StockQuantity FROM dbo.ProductVariants WHERE VariantID = @VariantID) <> @StockBefore
    INSERT INTO @Results VALUES
        (N'Rollback giữ nguyên tồn kho', 'FAIL', NULL, N'Tồn kho đã thay đổi sau test lỗi.');
ELSE
    INSERT INTO @Results VALUES
        (N'Rollback giữ nguyên tồn kho', 'PASS', NULL, N'Tồn kho không đổi.');

IF (SELECT COUNT_BIG(*) FROM dbo.Orders) <> @OrderCountBefore
    INSERT INTO @Results VALUES
        (N'Rollback không để lại đơn rác', 'FAIL', NULL, N'Số đơn hàng đã thay đổi.');
ELSE
    INSERT INTO @Results VALUES
        (N'Rollback không để lại đơn rác', 'PASS', NULL, N'Số đơn hàng không đổi.');

IF (SELECT UsedCount FROM dbo.Vouchers WHERE VoucherCode = 'BEST10') <> @VoucherUsedBefore
    INSERT INTO @Results VALUES
        (N'Rollback giữ nguyên voucher', 'FAIL', NULL, N'UsedCount của BEST10 đã thay đổi.');
ELSE
    INSERT INTO @Results VALUES
        (N'Rollback giữ nguyên voucher', 'PASS', NULL, N'UsedCount không đổi.');

SELECT TestName, Result, ErrorNumber, Detail
FROM @Results
ORDER BY TestName;

IF EXISTS (SELECT 1 FROM @Results WHERE Result = 'FAIL')
    THROW 51199, N'Có kiểm thử rollback không đạt. Xem result grid phía trên.', 1;
GO
