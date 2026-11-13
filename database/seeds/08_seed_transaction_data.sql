/*
    DECO - Repeatable transaction seed data.

    Creates five demo orders through the real stored procedures so stock,
    payments, voucher usage and both audit triggers remain consistent.
    Re-running the script does not create duplicate seed orders.
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

DECLARE @VariantID BIGINT =
(
    SELECT TOP (1) variant.VariantID
    FROM dbo.ProductVariants AS variant
    INNER JOIN dbo.Products AS product ON product.ProductID = variant.ProductID
    INNER JOIN dbo.Categories AS category ON category.CategoryID = product.CategoryID
    INNER JOIN dbo.Sizes AS size ON size.SizeID = variant.SizeID
    INNER JOIN dbo.Colors AS color ON color.ColorID = variant.ColorID
    WHERE variant.IsActive = 1
      AND product.IsActive = 1
      AND category.IsActive = 1
      AND size.IsActive = 1
      AND color.IsActive = 1
      AND variant.StockQuantity >= 8
    ORDER BY variant.StockQuantity DESC, variant.VariantID
);

IF @CustomerID IS NULL OR @AdminUserID IS NULL
    THROW 51100, N'Cần ít nhất một CUSTOMER và một ADMIN đang hoạt động.', 1;

IF @VariantID IS NULL
    THROW 51101, N'Cần một biến thể đang bán có tồn kho ít nhất 8 để tạo dữ liệu demo.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    /* 1. PENDING + COD/PENDING */
    IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Note = N'[SEED:ORDER:PENDING_COD]')
    BEGIN
        DECLARE @ItemsPending dbo.OrderItemInputType;
        INSERT INTO @ItemsPending VALUES (@VariantID, 1);
        DECLARE @PendingOrderID BIGINT, @PendingOrderCode VARCHAR(30);

        EXEC dbo.sp_CreateOrder
            @UserID = @CustomerID,
            @RecipientName = N'Khách demo Pending',
            @RecipientPhone = '0901000001',
            @ShippingAddress = N'01 Đường Demo, TP.HCM',
            @Items = @ItemsPending,
            @PaymentMethod = 'COD',
            @Note = N'[SEED:ORDER:PENDING_COD]',
            @OrderID = @PendingOrderID OUTPUT,
            @OrderCode = @PendingOrderCode OUTPUT;
    END;

    /* 2. PREPARING + COD/PENDING */
    IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Note = N'[SEED:ORDER:PREPARING_COD]')
    BEGIN
        DECLARE @ItemsPreparing dbo.OrderItemInputType;
        INSERT INTO @ItemsPreparing VALUES (@VariantID, 1);
        DECLARE @PreparingOrderID BIGINT, @PreparingOrderCode VARCHAR(30);

        EXEC dbo.sp_CreateOrder
            @UserID = @CustomerID,
            @RecipientName = N'Khách demo Preparing',
            @RecipientPhone = '0901000002',
            @ShippingAddress = N'02 Đường Demo, TP.HCM',
            @Items = @ItemsPreparing,
            @PaymentMethod = 'COD',
            @Note = N'[SEED:ORDER:PREPARING_COD]',
            @OrderID = @PreparingOrderID OUTPUT,
            @OrderCode = @PreparingOrderCode OUTPUT;

        EXEC dbo.sp_UpdateOrderStatus
            @OrderID = @PreparingOrderID,
            @NewStatus = 'PREPARING',
            @AdminUserID = @AdminUserID,
            @StatusNote = N'Dữ liệu demo: admin đang chuẩn bị hàng';
    END;

    /* 3. SHIPPING + COD/PENDING */
    IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Note = N'[SEED:ORDER:SHIPPING_COD]')
    BEGIN
        DECLARE @ItemsShipping dbo.OrderItemInputType;
        INSERT INTO @ItemsShipping VALUES (@VariantID, 1);
        DECLARE @ShippingOrderID BIGINT, @ShippingOrderCode VARCHAR(30);

        EXEC dbo.sp_CreateOrder
            @UserID = @CustomerID,
            @RecipientName = N'Khách demo Shipping',
            @RecipientPhone = '0901000003',
            @ShippingAddress = N'03 Đường Demo, TP.HCM',
            @Items = @ItemsShipping,
            @PaymentMethod = 'COD',
            @Note = N'[SEED:ORDER:SHIPPING_COD]',
            @OrderID = @ShippingOrderID OUTPUT,
            @OrderCode = @ShippingOrderCode OUTPUT;

        EXEC dbo.sp_UpdateOrderStatus @ShippingOrderID, 'PREPARING', @AdminUserID,
            N'Dữ liệu demo: bắt đầu chuẩn bị hàng';
        EXEC dbo.sp_UpdateOrderStatus @ShippingOrderID, 'SHIPPING', @AdminUserID,
            N'Dữ liệu demo: đã bàn giao cho đơn vị vận chuyển';
    END;

    /* 4. COMPLETED + COD/PAID; also demonstrates BEST10. */
    IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Note = N'[SEED:ORDER:COMPLETED_COD]')
    BEGIN
        DECLARE @ItemsCompleted dbo.OrderItemInputType;
        INSERT INTO @ItemsCompleted VALUES (@VariantID, 1);
        DECLARE @CompletedOrderID BIGINT, @CompletedOrderCode VARCHAR(30);

        EXEC dbo.sp_CreateOrder
            @UserID = @CustomerID,
            @RecipientName = N'Khách demo Completed',
            @RecipientPhone = '0901000004',
            @ShippingAddress = N'04 Đường Demo, TP.HCM',
            @Items = @ItemsCompleted,
            @VoucherCode = 'BEST10',
            @PaymentMethod = 'COD',
            @Note = N'[SEED:ORDER:COMPLETED_COD]',
            @OrderID = @CompletedOrderID OUTPUT,
            @OrderCode = @CompletedOrderCode OUTPUT;

        EXEC dbo.sp_UpdateOrderStatus @CompletedOrderID, 'PREPARING', @AdminUserID,
            N'Dữ liệu demo: chuẩn bị đơn có voucher';
        EXEC dbo.sp_UpdateOrderStatus @CompletedOrderID, 'SHIPPING', @AdminUserID,
            N'Dữ liệu demo: đang giao đơn có voucher';
        EXEC dbo.sp_CompleteOrder @CompletedOrderID, @AdminUserID, 1,
            N'Dữ liệu demo: giao hàng và thu COD thành công';
    END;

    /* 5. CANCELLED + BANK/DENIED; cancellation restores its stock. */
    IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Note = N'[SEED:ORDER:CANCELLED_BANK_DENIED]')
    BEGIN
        DECLARE @ItemsCancelled dbo.OrderItemInputType;
        INSERT INTO @ItemsCancelled VALUES (@VariantID, 1);
        DECLARE @CancelledOrderID BIGINT, @CancelledOrderCode VARCHAR(30);
        DECLARE @CancelledPaymentID BIGINT;
        DECLARE @DeniedRef VARCHAR(100);

        EXEC dbo.sp_CreateOrder
            @UserID = @CustomerID,
            @RecipientName = N'Khách demo Cancelled',
            @RecipientPhone = '0901000005',
            @ShippingAddress = N'05 Đường Demo, TP.HCM',
            @Items = @ItemsCancelled,
            @PaymentMethod = 'BANK',
            @Note = N'[SEED:ORDER:CANCELLED_BANK_DENIED]',
            @OrderID = @CancelledOrderID OUTPUT,
            @OrderCode = @CancelledOrderCode OUTPUT;

        SELECT @CancelledPaymentID = PaymentID
        FROM dbo.Payments
        WHERE OrderID = @CancelledOrderID;

        SET @DeniedRef = 'SEED-DENIED-' + CONVERT(VARCHAR(20), @CancelledPaymentID);

        EXEC dbo.sp_RecordOnlinePaymentResult
            @PaymentID = @CancelledPaymentID,
            @TransactionRef = @DeniedRef,
            @ResultStatus = 'DENIED';

        EXEC dbo.sp_CancelOrder
            @OrderID = @CancelledOrderID,
            @RequestedByUserID = @CustomerID,
            @StatusNote = N'Dữ liệu demo: khách hủy sau khi ngân hàng từ chối';
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    customerOrder.OrderID,
    customerOrder.OrderCode,
    customerOrder.Note AS SeedKey,
    customerOrder.Status AS OrderStatus,
    customerOrder.TotalAmount,
    payment.PaymentMethod,
    payment.PaymentStatus,
    payment.TransactionRef
FROM dbo.Orders AS customerOrder
INNER JOIN dbo.Payments AS payment ON payment.OrderID = customerOrder.OrderID
WHERE customerOrder.Note LIKE N'[[]SEED:ORDER:%'
ORDER BY customerOrder.OrderID;
GO
