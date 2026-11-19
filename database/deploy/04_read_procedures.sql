USE DECO;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetCatalogLookups
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CategoryID, Name FROM dbo.Categories WHERE IsActive = 1 ORDER BY Name;
    SELECT SizeID, Name, SortOrder FROM dbo.Sizes WHERE IsActive = 1 ORDER BY SortOrder, Name;
    SELECT ColorID, Name, HexCode FROM dbo.Colors WHERE IsActive = 1 ORDER BY Name;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AdminGetOrders
    @AdminUserID BIGINT,
    @Status VARCHAR(20) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1)
        THROW 50300, N'Chỉ quản trị viên đang hoạt động mới được xem danh sách đơn.', 1;
    SET @Status = NULLIF(UPPER(LTRIM(RTRIM(@Status))), '');
    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize NOT BETWEEN 1 AND 100 SET @PageSize = 20;
    SELECT o.OrderID, o.OrderCode, o.RecipientName, o.RecipientPhone, o.TotalAmount,
           o.Status, o.CreatedAt, COUNT(oi.OrderItemID) AS ItemCount
    FROM dbo.Orders o
    JOIN dbo.OrderItems oi ON oi.OrderID=o.OrderID
    WHERE @Status IS NULL OR o.Status=@Status
    GROUP BY o.OrderID,o.OrderCode,o.RecipientName,o.RecipientPhone,o.TotalAmount,o.Status,o.CreatedAt
    ORDER BY o.CreatedAt DESC, o.OrderID DESC
    OFFSET (@PageNumber-1)*@PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AdminGetProducts
    @AdminUserID BIGINT,
    @Keyword NVARCHAR(200) = NULL,
    @IncludeInactive BIT = 1,
    @PageNumber INT = 1,
    @PageSize INT = 100
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserID = @AdminUserID
          AND Role = 'ADMIN'
          AND IsActive = 1
    )
        THROW 50301, N'Chỉ quản trị viên đang hoạt động mới được xem danh sách sản phẩm quản trị.', 1;

    SET @Keyword = NULLIF(LTRIM(RTRIM(@Keyword)), N'');
    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize NOT BETWEEN 1 AND 100 SET @PageSize = 100;

    SELECT
        product.ProductID,
        product.CategoryID,
        category.Name AS CategoryName,
        product.Name,
        product.Description,
        product.Price,
        product.IsActive,
        product.CreatedAt,
        product.UpdatedAt,
        primaryImage.ImageUrl AS PrimaryImageUrl,
        COALESCE(variantSummary.TotalStock, 0) AS TotalStock,
        COALESCE(variantSummary.VariantCount, 0) AS VariantCount,
        variantSummary.PrimarySKU,
        COUNT(*) OVER() AS TotalCount
    FROM dbo.Products AS product
    INNER JOIN dbo.Categories AS category
        ON category.CategoryID = product.CategoryID
    OUTER APPLY
    (
        SELECT TOP (1) image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductID = product.ProductID
        ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID
    ) AS primaryImage
    OUTER APPLY
    (
        SELECT
            SUM(CASE WHEN variant.IsActive = 1 THEN variant.StockQuantity ELSE 0 END) AS TotalStock,
            COUNT(*) AS VariantCount,
            MIN(variant.SKU) AS PrimarySKU
        FROM dbo.ProductVariants AS variant
        WHERE variant.ProductID = product.ProductID
    ) AS variantSummary
    WHERE (@IncludeInactive = 1 OR product.IsActive = 1)
      AND
      (
          @Keyword IS NULL
          OR product.Name LIKE N'%' + @Keyword + N'%'
          OR product.Description LIKE N'%' + @Keyword + N'%'
          OR variantSummary.PrimarySKU LIKE '%' + CONVERT(VARCHAR(200), @Keyword) + '%'
      )
    ORDER BY product.UpdatedAt DESC, product.ProductID DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AdminGetProductDetail
    @AdminUserID BIGINT,
    @ProductID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserID = @AdminUserID
          AND Role = 'ADMIN'
          AND IsActive = 1
    )
        THROW 50302, N'Chỉ quản trị viên đang hoạt động mới được xem chi tiết sản phẩm quản trị.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductID = @ProductID)
        THROW 50303, N'Sản phẩm không tồn tại.', 1;

    SELECT
        product.ProductID,
        product.CategoryID,
        category.Name AS CategoryName,
        product.Name,
        product.Description,
        product.Price,
        product.IsActive,
        product.CreatedAt,
        product.UpdatedAt,
        primaryImage.ImageUrl AS PrimaryImageUrl
    FROM dbo.Products AS product
    INNER JOIN dbo.Categories AS category
        ON category.CategoryID = product.CategoryID
    OUTER APPLY
    (
        SELECT TOP (1) image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductID = product.ProductID
        ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID
    ) AS primaryImage
    WHERE product.ProductID = @ProductID;

    SELECT
        variant.VariantID,
        variant.ProductID,
        variant.SizeID,
        size.Name AS SizeName,
        variant.ColorID,
        color.Name AS ColorName,
        color.HexCode,
        variant.SKU,
        variant.StockQuantity,
        variant.IsActive,
        variant.UpdatedAt
    FROM dbo.ProductVariants AS variant
    INNER JOIN dbo.Sizes AS size ON size.SizeID = variant.SizeID
    INNER JOIN dbo.Colors AS color ON color.ColorID = variant.ColorID
    WHERE variant.ProductID = @ProductID
    ORDER BY size.SortOrder, color.Name, variant.VariantID;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetProducts
    @Keyword NVARCHAR(200) = NULL,
    @CategoryID INT = NULL,
    @SizeID INT = NULL,
    @ColorID INT = NULL,
    @MinPrice DECIMAL(18,2) = NULL,
    @MaxPrice DECIMAL(18,2) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Keyword = NULLIF(LTRIM(RTRIM(@Keyword)), N'');

    IF @PageNumber < 1
        SET @PageNumber = 1;

    IF @PageSize < 1
        SET @PageSize = 20;

    IF @PageSize > 100
        SET @PageSize = 100;

    IF @MinPrice IS NOT NULL AND @MinPrice < 0
        THROW 50010, N'Giá tối thiểu không được âm.', 1;

    IF @MaxPrice IS NOT NULL AND @MaxPrice < 0
        THROW 50011, N'Giá tối đa không được âm.', 1;

    IF @MinPrice IS NOT NULL
       AND @MaxPrice IS NOT NULL
       AND @MinPrice > @MaxPrice
        THROW 50012, N'Giá tối thiểu không được lớn hơn giá tối đa.', 1;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    ;WITH FilteredProducts AS
    (
        SELECT
            product.ProductID,
            product.Name,
            product.Description,
            product.Price,
            product.CategoryID,
            category.Name AS CategoryName,
            product.CreatedAt
        FROM dbo.Products AS product
        INNER JOIN dbo.Categories AS category
            ON category.CategoryID = product.CategoryID
        WHERE product.IsActive = 1
          AND category.IsActive = 1
          AND
              (
                  @Keyword IS NULL
                  OR product.Name LIKE N'%' + @Keyword + N'%'
                  OR product.Description LIKE N'%' + @Keyword + N'%'
              )
          AND (@CategoryID IS NULL OR product.CategoryID = @CategoryID)
          AND (@MinPrice IS NULL OR product.Price >= @MinPrice)
          AND (@MaxPrice IS NULL OR product.Price <= @MaxPrice)
          AND
          (
              (@SizeID IS NULL AND @ColorID IS NULL)
              OR EXISTS
              (
                  SELECT 1
                  FROM dbo.ProductVariants AS filteredVariant
                  WHERE filteredVariant.ProductID = product.ProductID
                    AND filteredVariant.IsActive = 1
                    AND filteredVariant.StockQuantity > 0
                    AND (@SizeID IS NULL OR filteredVariant.SizeID = @SizeID)
                    AND (@ColorID IS NULL OR filteredVariant.ColorID = @ColorID)
              )
          )
    )
    SELECT
        filtered.ProductID,
        filtered.Name,
        filtered.Description,
        filtered.Price,
        filtered.CategoryID,
        filtered.CategoryName,
        primaryImage.ImageUrl AS PrimaryImageUrl,
        COALESCE(stock.TotalStock, 0) AS TotalStock,
        COUNT(*) OVER() AS TotalCount
    FROM FilteredProducts AS filtered
    OUTER APPLY
    (
        SELECT TOP (1)
            image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductID = filtered.ProductID
        ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID
    ) AS primaryImage
    OUTER APPLY
    (
        SELECT SUM(variant.StockQuantity) AS TotalStock
        FROM dbo.ProductVariants AS variant
        WHERE variant.ProductID = filtered.ProductID
          AND variant.IsActive = 1
    ) AS stock
    ORDER BY filtered.CreatedAt DESC, filtered.ProductID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetProductDetail
    @ProductID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Products
        WHERE ProductID = @ProductID
          AND IsActive = 1
    )
        THROW 50020, N'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 1;

    SELECT
        product.ProductID,
        product.Name,
        product.Description,
        product.Price,
        product.CategoryID,
        category.Name AS CategoryName,
        product.CreatedAt,
        product.UpdatedAt,
        primaryImage.ImageUrl AS PrimaryImageUrl,
        COALESCE(stock.TotalStock, 0) AS TotalStock
    FROM dbo.Products AS product
    INNER JOIN dbo.Categories AS category
        ON category.CategoryID = product.CategoryID
    OUTER APPLY
    (
        SELECT TOP (1)
            image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductID = product.ProductID
        ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID
    ) AS primaryImage
    OUTER APPLY
    (
        SELECT SUM(variant.StockQuantity) AS TotalStock
        FROM dbo.ProductVariants AS variant
        WHERE variant.ProductID = product.ProductID
          AND variant.IsActive = 1
    ) AS stock
    WHERE product.ProductID = @ProductID;

    SELECT
        image.ImageID,
        image.ImageUrl,
        image.IsPrimary,
        image.SortOrder
    FROM dbo.ProductImages AS image
    WHERE image.ProductID = @ProductID
    ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID;

    SELECT
        variant.VariantID,
        variant.SKU,
        variant.SizeID,
        size.Name AS SizeName,
        size.SortOrder AS SizeSortOrder,
        variant.ColorID,
        color.Name AS ColorName,
        color.HexCode,
        variant.StockQuantity,
        variant.IsActive
    FROM dbo.ProductVariants AS variant
    INNER JOIN dbo.Sizes AS size
        ON size.SizeID = variant.SizeID
    INNER JOIN dbo.Colors AS color
        ON color.ColorID = variant.ColorID
    WHERE variant.ProductID = @ProductID
      AND variant.IsActive = 1
      AND size.IsActive = 1
      AND color.IsActive = 1
    ORDER BY size.SortOrder, color.Name, variant.VariantID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetUserOrders
    @UserID BIGINT,
    @Status VARCHAR(20) = NULL,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    SET @Status = UPPER(NULLIF(LTRIM(RTRIM(@Status)), ''));

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserID = @UserID
    )
        THROW 50030, N'Người dùng không tồn tại.', 1;

    IF @Status IS NOT NULL
       AND @Status NOT IN ('PENDING', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED')
        THROW 50031, N'Trạng thái đơn hàng không hợp lệ.', 1;

    IF @PageNumber < 1
        SET @PageNumber = 1;

    IF @PageSize < 1
        SET @PageSize = 20;

    IF @PageSize > 100
        SET @PageSize = 100;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        customerOrder.OrderID,
        customerOrder.OrderCode,
        customerOrder.CreatedAt,
        customerOrder.UpdatedAt,
        customerOrder.Status,
        customerOrder.Subtotal,
        customerOrder.ShippingFee,
        customerOrder.DiscountAmount,
        customerOrder.TotalAmount,
        itemSummary.TotalItems,
        latestPayment.PaymentID,
        latestPayment.PaymentMethod,
        latestPayment.PaymentStatus,
        latestPayment.TransactionRef,
        COUNT(*) OVER() AS TotalCount
    FROM dbo.Orders AS customerOrder
    OUTER APPLY
    (
        SELECT SUM(orderItem.Quantity) AS TotalItems
        FROM dbo.OrderItems AS orderItem
        WHERE orderItem.OrderID = customerOrder.OrderID
    ) AS itemSummary
    OUTER APPLY
    (
        SELECT TOP (1)
            payment.PaymentID,
            payment.PaymentMethod,
            payment.PaymentStatus,
            payment.TransactionRef
        FROM dbo.Payments AS payment
        WHERE payment.OrderID = customerOrder.OrderID
        ORDER BY
            CASE WHEN payment.PaymentStatus = 'PAID' THEN 0 ELSE 1 END,
            payment.CreatedAt DESC,
            payment.PaymentID DESC
    ) AS latestPayment
    WHERE customerOrder.UserID = @UserID
      AND (@Status IS NULL OR customerOrder.Status = @Status)
    ORDER BY customerOrder.CreatedAt DESC, customerOrder.OrderID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetOrderDetail
    @OrderID BIGINT,
    @RequestedByUserID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OrderOwnerID BIGINT;
    DECLARE @RequesterRole VARCHAR(20);

    SELECT @OrderOwnerID = UserID
    FROM dbo.Orders
    WHERE OrderID = @OrderID;

    IF @OrderOwnerID IS NULL
        THROW 50040, N'Đơn hàng không tồn tại.', 1;

    SELECT @RequesterRole = Role
    FROM dbo.Users
    WHERE UserID = @RequestedByUserID
      AND IsActive = 1;

    IF @RequesterRole IS NULL
        THROW 50041, N'Người yêu cầu không tồn tại hoặc đã bị khóa.', 1;

    IF @RequesterRole <> 'ADMIN'
       AND @RequestedByUserID <> @OrderOwnerID
        THROW 50042, N'Bạn không có quyền xem đơn hàng này.', 1;

    SELECT
        customerOrder.OrderID,
        customerOrder.OrderCode,
        customerOrder.UserID,
        customerOrder.VoucherID,
        voucher.VoucherCode,
        customerOrder.RecipientName,
        customerOrder.RecipientPhone,
        customerOrder.ShippingAddress,
        customerOrder.Subtotal,
        customerOrder.ShippingFee,
        customerOrder.DiscountAmount,
        customerOrder.TotalAmount,
        customerOrder.Status,
        customerOrder.Note,
        customerOrder.CreatedAt,
        customerOrder.UpdatedAt,
        customerOrder.UpdatedByUserID
    FROM dbo.Orders AS customerOrder
    LEFT JOIN dbo.Vouchers AS voucher
        ON voucher.VoucherID = customerOrder.VoucherID
    WHERE customerOrder.OrderID = @OrderID;

    SELECT
        orderItem.OrderItemID,
        orderItem.ProductVariantID,
        variant.SKU,
        orderItem.ProductNameSnapshot,
        orderItem.SizeNameSnapshot,
        orderItem.ColorNameSnapshot,
        orderItem.Quantity,
        orderItem.UnitPrice,
        orderItem.LineTotal
    FROM dbo.OrderItems AS orderItem
    INNER JOIN dbo.ProductVariants AS variant
        ON variant.VariantID = orderItem.ProductVariantID
    WHERE orderItem.OrderID = @OrderID
    ORDER BY orderItem.OrderItemID;

    SELECT
        payment.PaymentID,
        payment.Amount,
        payment.PaymentMethod,
        payment.PaymentStatus,
        payment.TransactionRef,
        payment.CreatedAt,
        payment.PaidAt,
        payment.UpdatedAt
    FROM dbo.Payments AS payment
    WHERE payment.OrderID = @OrderID
    ORDER BY payment.CreatedAt DESC, payment.PaymentID DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetProductPriceHistory
    @ProductID BIGINT,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Products
        WHERE ProductID = @ProductID
    )
        THROW 50050, N'Sản phẩm không tồn tại.', 1;

    IF @PageNumber < 1
        SET @PageNumber = 1;

    IF @PageSize < 1
        SET @PageSize = 20;

    IF @PageSize > 100
        SET @PageSize = 100;

    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SELECT
        history.PriceHistoryID,
        history.ProductID,
        product.Name AS ProductName,
        history.OldPrice,
        history.NewPrice,
        history.ChangedByUserID,
        changedBy.FullName AS ChangedByName,
        history.ChangedAt,
        COUNT(*) OVER() AS TotalCount
    FROM dbo.ProductPriceHistory AS history
    INNER JOIN dbo.Products AS product
        ON product.ProductID = history.ProductID
    LEFT JOIN dbo.Users AS changedBy
        ON changedBy.UserID = history.ChangedByUserID
    WHERE history.ProductID = @ProductID
    ORDER BY history.ChangedAt DESC, history.PriceHistoryID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetOrderStatusHistory
    @OrderID BIGINT,
    @RequestedByUserID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OrderOwnerID BIGINT;
    DECLARE @RequesterRole VARCHAR(20);

    SELECT @OrderOwnerID = UserID
    FROM dbo.Orders
    WHERE OrderID = @OrderID;

    IF @OrderOwnerID IS NULL
        THROW 50060, N'Đơn hàng không tồn tại.', 1;

    SELECT @RequesterRole = Role
    FROM dbo.Users
    WHERE UserID = @RequestedByUserID
      AND IsActive = 1;

    IF @RequesterRole IS NULL
        THROW 50061, N'Người yêu cầu không tồn tại hoặc đã bị khóa.', 1;

    IF @RequesterRole <> 'ADMIN'
       AND @RequestedByUserID <> @OrderOwnerID
        THROW 50062, N'Bạn không có quyền xem lịch sử đơn hàng này.', 1;

    SELECT
        history.StatusHistoryID,
        history.OrderID,
        customerOrder.OrderCode,
        history.OldStatus,
        history.NewStatus,
        history.ChangedByUserID,
        changedBy.FullName AS ChangedByName,
        history.Note,
        history.ChangedAt
    FROM dbo.OrderStatusHistory AS history
    INNER JOIN dbo.Orders AS customerOrder
        ON customerOrder.OrderID = history.OrderID
    LEFT JOIN dbo.Users AS changedBy
        ON changedBy.UserID = history.ChangedByUserID
    WHERE history.OrderID = @OrderID
    ORDER BY history.ChangedAt, history.StatusHistoryID;
END;
GO

/* ====================================================================
   Verification: list the read procedures in this module.
   ==================================================================== */
SELECT
    procedureObject.name AS ProcedureName,
    procedureObject.create_date AS CreatedAt,
    procedureObject.modify_date AS ModifiedAt
FROM sys.procedures AS procedureObject
WHERE procedureObject.name IN
(
    N'sp_GetProducts',
    N'sp_GetProductDetail',
    N'sp_GetUserOrders',
    N'sp_GetOrderDetail',
    N'sp_GetProductPriceHistory',
    N'sp_GetOrderStatusHistory',
    N'sp_GetCatalogLookups',
    N'sp_AdminGetOrders',
    N'sp_AdminGetProducts',
    N'sp_AdminGetProductDetail'
)
ORDER BY procedureObject.name;
GO

