/* ============================================================================
   DECO - Transaction procedures (SQL Server 2022+)

   Depends on:
     01_schema.sql, 02_seed_master_data.sql, 03_table_types.sql

   Design decisions:
   - CreateOrder reserves stock immediately and creates one PENDING payment.
   - A voucher is consumed when the order is created; cancellation releases it.
   - A customer may cancel only PENDING orders. An active ADMIN may also cancel
     PREPARING orders. SHIPPING / COMPLETED orders are not cancellable here.
   - A PAID order cannot be cancelled without a separate refund workflow.
   - CompleteOrder requires SHIPPING. COD must be explicitly confirmed as
     collected; BANK/WALLET must already have a PAID payment.
   - RecordOnlinePaymentResult only stores PAID/DENIED results received from
     an external BANK/WALLET provider; it never completes an order.
   - The 07_triggers.sql module owns OrderStatusHistory (INSERT/UPDATE of Orders).
     Do NOT insert history here as well, or the same event will be logged twice.
     StatusNote is passed through SESSION_CONTEXT, as in 05_write_procedures.sql.
   - All stored timestamps use UTC, matching the existing schema.
   ============================================================================ */

USE DECO;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================================
   1. sp_CreateOrder - create order, items, payment; reserve stock and voucher.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_CreateOrder
    @UserID BIGINT,
    @RecipientName NVARCHAR(100),
    @RecipientPhone VARCHAR(15),
    @ShippingAddress NVARCHAR(500),
    @Items dbo.OrderItemInputType READONLY,
    @VoucherCode VARCHAR(50) = NULL,
    @PaymentMethod VARCHAR(20) = 'COD',
    @ShippingFee DECIMAL(18,2) = 30000, -- fixed MVP policy; never take this value from the browser
    @Note NVARCHAR(500) = NULL,
    @OrderID BIGINT = NULL OUTPUT,
    @OrderCode VARCHAR(30) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @OrderID = NULL;
    SET @OrderCode = NULL;
    SET @VoucherCode = NULLIF(UPPER(LTRIM(RTRIM(@VoucherCode))), '');
    SET @PaymentMethod = UPPER(LTRIM(RTRIM(@PaymentMethod)));
    SET @Note = NULLIF(LTRIM(RTRIM(@Note)), N'');
    SET @RecipientName = NULLIF(LTRIM(RTRIM(@RecipientName)), N'');
    SET @RecipientPhone = NULLIF(LTRIM(RTRIM(@RecipientPhone)), '');
    SET @ShippingAddress = NULLIF(LTRIM(RTRIM(@ShippingAddress)), N'');

    IF @UserID IS NULL
        THROW 50200, N'Phải cung cấp người mua.', 1;

    IF @RecipientName IS NULL OR @RecipientPhone IS NULL OR @ShippingAddress IS NULL
        THROW 50205, N'Thông tin nhận hàng không đầy đủ.', 1;

    IF LEN(@RecipientPhone) <> 10
       OR LEFT(@RecipientPhone, 1) <> '0'
       OR @RecipientPhone LIKE '%[^0-9]%'
        THROW 50216, N'Số điện thoại nhận hàng phải gồm 10 chữ số và bắt đầu bằng 0.', 1;

    IF NOT EXISTS (SELECT 1 FROM @Items)
        THROW 50201, N'Giỏ hàng không được rỗng.', 1;

    IF @ShippingFee IS NULL OR @ShippingFee < 0
        THROW 50202, N'Phí vận chuyển không hợp lệ.', 1;

    IF @PaymentMethod IS NULL OR @PaymentMethod NOT IN ('COD', 'BANK', 'WALLET')
        THROW 50203, N'Phương thức thanh toán không hợp lệ.', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Subtotal DECIMAL(18,2);
    DECLARE @DiscountAmount DECIMAL(18,2) = 0;
    DECLARE @VoucherID BIGINT = NULL;
    DECLARE @DiscountType VARCHAR(10);
    DECLARE @DiscountValue DECIMAL(18,2);
    DECLARE @MaxDiscount DECIMAL(18,2);
    DECLARE @MinOrderAmount DECIMAL(18,2);
    DECLARE @UsageLimit INT;
    DECLARE @UsedCount INT;
    DECLARE @VoucherStartAt DATETIME2(0);
    DECLARE @VoucherEndAt DATETIME2(0);
    DECLARE @VoucherIsActive BIT;
    DECLARE @ExpectedItemCount INT = (SELECT COUNT(*) FROM @Items);
    DECLARE @UpdatedItemCount INT;
    DECLARE @CreatedOrderID BIGINT;
    DECLARE @CreatedOrderCode VARCHAR(30);

    -- Snapshot product information at checkout; never trust a client price.
    DECLARE @ResolvedItems TABLE
    (
        ProductVariantID BIGINT NOT NULL PRIMARY KEY,
        Quantity INT NOT NULL,
        StockQuantity INT NOT NULL,
        ProductNameSnapshot NVARCHAR(200) NOT NULL,
        SizeNameSnapshot NVARCHAR(30) NOT NULL,
        ColorNameSnapshot NVARCHAR(50) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL
    );

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.Users
            WHERE UserID = @UserID
              AND Role = 'CUSTOMER'
              AND IsActive = 1
        )
            THROW 50204, N'Khách hàng không tồn tại hoặc đã bị khóa.', 1;

        -- UPDLOCK + HOLDLOCK keeps stock and prices stable until COMMIT/ROLLBACK.
        INSERT INTO @ResolvedItems
        (
            ProductVariantID,
            Quantity,
            StockQuantity,
            ProductNameSnapshot,
            SizeNameSnapshot,
            ColorNameSnapshot,
            UnitPrice
        )
        SELECT
            requested.ProductVariantID,
            requested.Quantity,
            variant.StockQuantity,
            product.Name,
            size.Name,
            color.Name,
            product.Price
        FROM @Items AS requested
        INNER JOIN dbo.ProductVariants AS variant WITH (UPDLOCK, HOLDLOCK)
            ON variant.VariantID = requested.ProductVariantID
           AND variant.IsActive = 1
        INNER JOIN dbo.Products AS product WITH (UPDLOCK, HOLDLOCK)
            ON product.ProductID = variant.ProductID
           AND product.IsActive = 1
        INNER JOIN dbo.Categories AS category
            ON category.CategoryID = product.CategoryID
           AND category.IsActive = 1
        INNER JOIN dbo.Sizes AS size
            ON size.SizeID = variant.SizeID
           AND size.IsActive = 1
        INNER JOIN dbo.Colors AS color
            ON color.ColorID = variant.ColorID
           AND color.IsActive = 1;

        IF (SELECT COUNT(*) FROM @ResolvedItems) <> @ExpectedItemCount
            THROW 50206, N'Có sản phẩm, kích cỡ hoặc màu không còn kinh doanh.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM @ResolvedItems
            WHERE StockQuantity < Quantity
        )
            THROW 50207, N'Số lượng đặt vượt quá tồn kho hiện tại.', 1;

        SELECT @Subtotal = SUM(Quantity * UnitPrice)
        FROM @ResolvedItems;

        -- Acquire an update lock on the voucher to prevent usage-limit races.
        IF @VoucherCode IS NOT NULL
        BEGIN
            SELECT
                @VoucherID = VoucherID,
                @DiscountType = DiscountType,
                @DiscountValue = DiscountValue,
                @MaxDiscount = MaxDiscount,
                @MinOrderAmount = MinOrderAmount,
                @UsageLimit = UsageLimit,
                @UsedCount = UsedCount,
                @VoucherStartAt = StartAt,
                @VoucherEndAt = EndAt,
                @VoucherIsActive = IsActive
            FROM dbo.Vouchers WITH (UPDLOCK, HOLDLOCK)
            WHERE VoucherCode = @VoucherCode;

            IF @VoucherID IS NULL
                THROW 50208, N'Mã giảm giá không tồn tại.', 1;

            IF @VoucherIsActive = 0 OR @Now < @VoucherStartAt OR @Now > @VoucherEndAt
                THROW 50209, N'Mã giảm giá chưa có hiệu lực hoặc đã hết hạn.', 1;

            IF @UsageLimit IS NOT NULL AND @UsedCount >= @UsageLimit
                THROW 50210, N'Mã giảm giá đã hết lượt sử dụng.', 1;

            -- Policy: minimum order amount is based on merchandise subtotal.
            IF @Subtotal < @MinOrderAmount
                THROW 50211, N'Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá.', 1;

            IF @DiscountType = 'PERCENT'
            BEGIN
                IF @DiscountValue > 100
                    THROW 50212, N'Cấu hình phần trăm giảm giá không hợp lệ.', 1;

                SET @DiscountAmount = ROUND(@Subtotal * @DiscountValue / 100, 2);
                IF @MaxDiscount IS NOT NULL AND @DiscountAmount > @MaxDiscount
                    SET @DiscountAmount = @MaxDiscount;
            END
            ELSE IF @DiscountType = 'FIXED'
                SET @DiscountAmount = @DiscountValue;
            ELSE
                THROW 50213, N'Loại giảm giá không hợp lệ.', 1;

            -- Voucher reduces merchandise only; it never makes shipping negative.
            IF @DiscountAmount > @Subtotal
                SET @DiscountAmount = @Subtotal;
        END;

        -- Atomic conditional update: even concurrent checkouts cannot oversell.
        UPDATE variant
        SET StockQuantity = variant.StockQuantity - item.Quantity,
            UpdatedAt = @Now
        FROM dbo.ProductVariants AS variant
        INNER JOIN @ResolvedItems AS item
            ON item.ProductVariantID = variant.VariantID
        WHERE variant.IsActive = 1
          AND variant.StockQuantity >= item.Quantity;

        SET @UpdatedItemCount = @@ROWCOUNT;
        IF @UpdatedItemCount <> @ExpectedItemCount
            THROW 50214, N'Tồn kho đã thay đổi, không thể tạo đơn hàng.', 1;

        IF @VoucherID IS NOT NULL
        BEGIN
            UPDATE dbo.Vouchers
            SET UsedCount = UsedCount + 1
            WHERE VoucherID = @VoucherID
              AND (UsageLimit IS NULL OR UsedCount < UsageLimit);

            IF @@ROWCOUNT <> 1
                THROW 50215, N'Mã giảm giá vừa hết lượt sử dụng.', 1;
        END;

        -- 29 characters: DECO- plus 24 hexadecimal UUID characters.
        SET @CreatedOrderCode =
            'DECO-' + LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 24);

        INSERT INTO dbo.Orders
        (
            OrderCode,
            UserID,
            VoucherID,
            RecipientName,
            RecipientPhone,
            ShippingAddress,
            Subtotal,
            ShippingFee,
            DiscountAmount,
            Status,
            Note,
            UpdatedByUserID
        )
        VALUES
        (
            @CreatedOrderCode,
            @UserID,
            @VoucherID,
            @RecipientName,
            @RecipientPhone,
            @ShippingAddress,
            @Subtotal,
            @ShippingFee,
            @DiscountAmount,
            'PENDING',
            @Note,
            @UserID
        );

        SET @CreatedOrderID = CONVERT(BIGINT, SCOPE_IDENTITY());

        INSERT INTO dbo.OrderItems
        (
            OrderID,
            ProductVariantID,
            ProductNameSnapshot,
            SizeNameSnapshot,
            ColorNameSnapshot,
            Quantity,
            UnitPrice
        )
        SELECT
            @CreatedOrderID,
            ProductVariantID,
            ProductNameSnapshot,
            SizeNameSnapshot,
            ColorNameSnapshot,
            Quantity,
            UnitPrice
        FROM @ResolvedItems;

        INSERT INTO dbo.Payments
        (
            OrderID,
            Amount,
            PaymentMethod,
            PaymentStatus
        )
        VALUES
        (
            @CreatedOrderID,
            @Subtotal + @ShippingFee - @DiscountAmount,
            @PaymentMethod,
            'PENDING'
        );

        COMMIT TRANSACTION;

        SET @OrderID = @CreatedOrderID;
        SET @OrderCode = @CreatedOrderCode;

        SELECT OrderID, OrderCode, UserID, Status, Subtotal, ShippingFee,
               DiscountAmount, TotalAmount, VoucherID
        FROM dbo.Orders
        WHERE OrderID = @OrderID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   2. sp_CancelOrder - cancel an unpaid order, return stock and voucher usage.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_CancelOrder
    @OrderID BIGINT,
    @RequestedByUserID BIGINT,
    @StatusNote NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @StatusNote = COALESCE(
        NULLIF(LTRIM(RTRIM(@StatusNote)), N''),
        N'Hủy đơn hàng'
    );

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @RequesterRole VARCHAR(20);
    DECLARE @OwnerID BIGINT;
    DECLARE @CurrentStatus VARCHAR(20);
    DECLARE @VoucherID BIGINT;
    DECLARE @ExpectedVariants INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @RequesterRole = Role
        FROM dbo.Users
        WHERE UserID = @RequestedByUserID
          AND IsActive = 1;

        IF @RequesterRole IS NULL
            THROW 50220, N'Người yêu cầu không tồn tại hoặc đã bị khóa.', 1;

        -- Serialize all cancellation/completion/status changes for this order.
        SELECT
            @OwnerID = UserID,
            @CurrentStatus = Status,
            @VoucherID = VoucherID
        FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderID = @OrderID;

        IF @OwnerID IS NULL
            THROW 50221, N'Đơn hàng không tồn tại.', 1;

        IF @RequesterRole <> 'ADMIN' AND @RequestedByUserID <> @OwnerID
            THROW 50222, N'Bạn không có quyền hủy đơn hàng này.', 1;

        IF @CurrentStatus NOT IN ('PENDING', 'PREPARING')
            THROW 50223, N'Không thể hủy đơn đang giao, đã hoàn tất hoặc đã hủy.', 1;

        IF @RequesterRole <> 'ADMIN' AND @CurrentStatus <> 'PENDING'
            THROW 50224, N'Khách hàng chỉ có thể hủy đơn đang chờ xử lý.', 1;

        -- No refund ledger exists in the schema: never silently cancel PAID.
        IF EXISTS
        (
            SELECT 1
            FROM dbo.Payments WITH (UPDLOCK, HOLDLOCK)
            WHERE OrderID = @OrderID
              AND PaymentStatus = 'PAID'
        )
            THROW 50225, N'Đơn đã thanh toán: cần quy trình hoàn tiền riêng.', 1;

        SELECT @ExpectedVariants = COUNT(DISTINCT ProductVariantID)
        FROM dbo.OrderItems
        WHERE OrderID = @OrderID;

        IF @ExpectedVariants = 0
            THROW 50226, N'Đơn hàng không có sản phẩm để hoàn kho.', 1;

        -- Group by variant so even legacy duplicate lines cannot restock twice.
        ;WITH Restock AS
        (
            SELECT ProductVariantID,
                   SUM(CONVERT(BIGINT, Quantity)) AS QuantityToRestore
            FROM dbo.OrderItems
            WHERE OrderID = @OrderID
            GROUP BY ProductVariantID
        )
        UPDATE variant
        SET StockQuantity = variant.StockQuantity + restock.QuantityToRestore,
            UpdatedAt = @Now
        FROM dbo.ProductVariants AS variant
        INNER JOIN Restock AS restock
            ON restock.ProductVariantID = variant.VariantID
        WHERE restock.QuantityToRestore <=
              CONVERT(BIGINT, 2147483647) - variant.StockQuantity;

        IF @@ROWCOUNT <> @ExpectedVariants
            THROW 50227, N'Không thể hoàn tồn kho cho toàn bộ sản phẩm.', 1;

        IF @VoucherID IS NOT NULL
        BEGIN
            UPDATE dbo.Vouchers
            SET UsedCount = UsedCount - 1
            WHERE VoucherID = @VoucherID
              AND UsedCount > 0;

            IF @@ROWCOUNT <> 1
                THROW 50228, N'Không thể hoàn lại lượt sử dụng voucher.', 1;
        END;

        UPDATE dbo.Payments
        SET PaymentStatus = 'CANCELLED',
            UpdatedAt = @Now
        WHERE OrderID = @OrderID
          AND PaymentStatus = 'PENDING';

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = @StatusNote;

        UPDATE dbo.Orders
        SET Status = 'CANCELLED',
            UpdatedAt = @Now,
            UpdatedByUserID = @RequestedByUserID
        WHERE OrderID = @OrderID
          AND Status = @CurrentStatus;

        IF @@ROWCOUNT <> 1
            THROW 50229, N'Trạng thái đơn hàng đã thay đổi.', 1;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = NULL;

        COMMIT TRANSACTION;

        SELECT OrderID, OrderCode, Status, UpdatedAt, UpdatedByUserID
        FROM dbo.Orders
        WHERE OrderID = @OrderID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = NULL;

        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   3. sp_CompleteOrder - complete a shipped order after payment verification.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_CompleteOrder
    @OrderID BIGINT,
    @AdminUserID BIGINT,
    @ConfirmCODCollected BIT = 0,
    @StatusNote NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @StatusNote = COALESCE(
        NULLIF(LTRIM(RTRIM(@StatusNote)), N''),
        N'Giao hàng thành công'
    );

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @CurrentStatus VARCHAR(20);
    DECLARE @TotalAmount DECIMAL(18,2);
    DECLARE @PaymentID BIGINT;
    DECLARE @PaymentMethod VARCHAR(20);
    DECLARE @PaymentStatus VARCHAR(20);
    DECLARE @PaymentAmount DECIMAL(18,2);

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.Users
            WHERE UserID = @AdminUserID
              AND Role = 'ADMIN'
              AND IsActive = 1
        )
            THROW 50240, N'Chỉ quản trị viên đang hoạt động mới được hoàn tất đơn.', 1;

        SELECT
            @CurrentStatus = Status,
            @TotalAmount = TotalAmount
        FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderID = @OrderID;

        IF @CurrentStatus IS NULL
            THROW 50241, N'Đơn hàng không tồn tại.', 1;

        IF @CurrentStatus <> 'SHIPPING'
            THROW 50242, N'Chỉ có thể hoàn tất đơn ở trạng thái SHIPPING.', 1;

        -- If there are retries, prefer the successful payment, then newest.
        SELECT TOP (1)
            @PaymentID = PaymentID,
            @PaymentMethod = PaymentMethod,
            @PaymentStatus = PaymentStatus,
            @PaymentAmount = Amount
        FROM dbo.Payments WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderID = @OrderID
        ORDER BY
            CASE WHEN PaymentStatus = 'PAID' THEN 0 ELSE 1 END,
            CreatedAt DESC,
            PaymentID DESC;

        IF @PaymentID IS NULL
            THROW 50243, N'Đơn hàng chưa có thông tin thanh toán.', 1;

        IF @PaymentAmount <> @TotalAmount
            THROW 50244, N'Số tiền thanh toán không khớp với đơn hàng.', 1;

        IF @PaymentStatus <> 'PAID'
        BEGIN
            IF @PaymentMethod <> 'COD' OR @PaymentStatus <> 'PENDING'
                THROW 50245, N'Chưa có thanh toán hợp lệ: BANK/WALLET cần PAID; COD cần PENDING.', 1;

            IF ISNULL(@ConfirmCODCollected, 0) <> 1
                THROW 50246, N'Cần xác nhận đã thu tiền COD trước khi hoàn tất.', 1;

            UPDATE dbo.Payments
            SET PaymentStatus = 'PAID',
                PaidAt = @Now,
                UpdatedAt = @Now
            WHERE PaymentID = @PaymentID
              AND PaymentStatus = 'PENDING';

            IF @@ROWCOUNT <> 1
                THROW 50247, N'Trạng thái thanh toán đã thay đổi.', 1;
        END;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = @StatusNote;

        UPDATE dbo.Orders
        SET Status = 'COMPLETED',
            UpdatedAt = @Now,
            UpdatedByUserID = @AdminUserID
        WHERE OrderID = @OrderID
          AND Status = 'SHIPPING';

        IF @@ROWCOUNT <> 1
            THROW 50248, N'Trạng thái đơn hàng đã thay đổi.', 1;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = NULL;

        COMMIT TRANSACTION;

        SELECT
            customerOrder.OrderID,
            customerOrder.OrderCode,
            customerOrder.Status,
            customerOrder.TotalAmount,
            payment.PaymentMethod,
            payment.PaymentStatus,
            payment.PaidAt
        FROM dbo.Orders AS customerOrder
        INNER JOIN dbo.Payments AS payment
            ON payment.PaymentID = @PaymentID
        WHERE customerOrder.OrderID = @OrderID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote', @value = NULL;

        THROW;
    END CATCH;
END;
GO

/* ============================================================================
   4. sp_RecordOnlinePaymentResult - persist a result received from an external
      BANK/WALLET provider. This procedure does not perform the payment and does
      not complete the order. Repeated identical callbacks are idempotent.
   ============================================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_RecordOnlinePaymentResult
    @PaymentID BIGINT,
    @TransactionRef VARCHAR(100),
    @ResultStatus VARCHAR(20),
    @PaidAt DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @TransactionRef = NULLIF(LTRIM(RTRIM(@TransactionRef)), '');
    SET @ResultStatus = UPPER(NULLIF(LTRIM(RTRIM(@ResultStatus)), ''));

    IF @PaymentID IS NULL
        THROW 50260, N'Phải cung cấp PaymentID.', 1;

    IF @TransactionRef IS NULL
        THROW 50261, N'Phải cung cấp mã giao dịch từ bên thanh toán.', 1;

    IF @ResultStatus IS NULL OR @ResultStatus NOT IN ('PAID', 'DENIED')
        THROW 50262, N'Kết quả thanh toán chỉ nhận PAID hoặc DENIED.', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @CurrentMethod VARCHAR(20);
    DECLARE @CurrentStatus VARCHAR(20);
    DECLARE @CurrentTransactionRef VARCHAR(100);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @CurrentMethod = PaymentMethod,
            @CurrentStatus = PaymentStatus,
            @CurrentTransactionRef = TransactionRef
        FROM dbo.Payments WITH (UPDLOCK, HOLDLOCK)
        WHERE PaymentID = @PaymentID;

        IF @CurrentMethod IS NULL
            THROW 50263, N'Không tìm thấy giao dịch thanh toán.', 1;

        IF @CurrentMethod NOT IN ('BANK', 'WALLET')
            THROW 50264, N'Procedure này không áp dụng cho thanh toán COD.', 1;

        -- The provider may retry the same callback. Return the stored result
        -- without writing it a second time.
        IF @CurrentStatus IN ('PAID', 'DENIED')
        BEGIN
            IF @CurrentStatus = @ResultStatus
               AND @CurrentTransactionRef = @TransactionRef
            BEGIN
                COMMIT TRANSACTION;

                SELECT
                    PaymentID,
                    OrderID,
                    Amount,
                    PaymentMethod,
                    PaymentStatus,
                    TransactionRef,
                    CreatedAt,
                    PaidAt,
                    UpdatedAt,
                    CAST(1 AS BIT) AS AlreadyProcessed
                FROM dbo.Payments
                WHERE PaymentID = @PaymentID;

                RETURN;
            END;

            THROW 50265, N'Giao dịch đã có kết quả khác và không thể ghi đè.', 1;
        END;

        IF @CurrentStatus <> 'PENDING'
            THROW 50266, N'Chỉ được ghi kết quả cho giao dịch đang PENDING.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.Payments WITH (UPDLOCK, HOLDLOCK)
            WHERE TransactionRef = @TransactionRef
              AND PaymentID <> @PaymentID
        )
            THROW 50267, N'Mã giao dịch đã được sử dụng cho Payment khác.', 1;

        UPDATE dbo.Payments
        SET PaymentStatus = @ResultStatus,
            TransactionRef = @TransactionRef,
            PaidAt = CASE
                         WHEN @ResultStatus = 'PAID'
                             THEN COALESCE(@PaidAt, @Now)
                         ELSE NULL
                     END,
            UpdatedAt = @Now
        WHERE PaymentID = @PaymentID
          AND PaymentStatus = 'PENDING';

        IF @@ROWCOUNT <> 1
            THROW 50268, N'Trạng thái Payment vừa thay đổi; hãy đọc lại kết quả.', 1;

        COMMIT TRANSACTION;

        SELECT
            PaymentID,
            OrderID,
            Amount,
            PaymentMethod,
            PaymentStatus,
            TransactionRef,
            CreatedAt,
            PaidAt,
            UpdatedAt,
            CAST(0 AS BIT) AS AlreadyProcessed
        FROM dbo.Payments
        WHERE PaymentID = @PaymentID;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END;
GO

/* Verify that the four transaction procedures were created. */
SELECT name AS ProcedureName, create_date AS CreatedAt, modify_date AS ModifiedAt
FROM sys.procedures
WHERE name IN
(
    N'sp_CreateOrder',
    N'sp_CancelOrder',
    N'sp_CompleteOrder',
    N'sp_RecordOnlinePaymentResult'
)
ORDER BY name;
GO
