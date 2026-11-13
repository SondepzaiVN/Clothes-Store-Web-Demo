USE DECO;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CreateProduct
 @CategoryID INT, @Name NVARCHAR(200), @Description NVARCHAR(MAX)=NULL,
 @Price DECIMAL(18,2), @AdminUserID BIGINT, @ProductID BIGINT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1) THROW 50310,N'Không có quyền quản trị.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Categories WHERE CategoryID=@CategoryID AND IsActive=1) THROW 50311,N'Danh mục không hợp lệ.',1;
 IF NULLIF(LTRIM(RTRIM(@Name)),N'') IS NULL OR @Price<0 THROW 50312,N'Tên hoặc giá sản phẩm không hợp lệ.',1;
 INSERT dbo.Products(CategoryID,Name,Description,Price,IsActive,UpdatedByUserID) VALUES(@CategoryID,LTRIM(RTRIM(@Name)),NULLIF(LTRIM(RTRIM(@Description)),N''),@Price,0,@AdminUserID);
 SET @ProductID=SCOPE_IDENTITY(); SELECT * FROM dbo.Products WHERE ProductID=@ProductID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateProduct
 @ProductID BIGINT,@CategoryID INT,@Name NVARCHAR(200),@Description NVARCHAR(MAX)=NULL,@AdminUserID BIGINT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1) THROW 50320,N'Không có quyền quản trị.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Categories WHERE CategoryID=@CategoryID AND IsActive=1) THROW 50321,N'Danh mục không hợp lệ.',1;
 UPDATE dbo.Products SET CategoryID=@CategoryID,Name=LTRIM(RTRIM(@Name)),Description=NULLIF(LTRIM(RTRIM(@Description)),N''),UpdatedAt=SYSUTCDATETIME(),UpdatedByUserID=@AdminUserID WHERE ProductID=@ProductID;
 IF @@ROWCOUNT=0 THROW 50322,N'Sản phẩm không tồn tại.',1; SELECT * FROM dbo.Products WHERE ProductID=@ProductID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_SetProductActive
 @ProductID BIGINT,@IsActive BIT,@AdminUserID BIGINT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1) THROW 50330,N'Không có quyền quản trị.',1;
 UPDATE dbo.Products SET IsActive=@IsActive,UpdatedAt=SYSUTCDATETIME(),UpdatedByUserID=@AdminUserID WHERE ProductID=@ProductID;
 IF @@ROWCOUNT=0 THROW 50331,N'Sản phẩm không tồn tại.',1; SELECT * FROM dbo.Products WHERE ProductID=@ProductID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpsertProductVariant
 @VariantID BIGINT=NULL,@ProductID BIGINT,@SizeID INT,@ColorID INT,@SKU VARCHAR(80),
 @StockQuantity INT,@IsActive BIT=1,@AdminUserID BIGINT,@SavedVariantID BIGINT OUTPUT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1) THROW 50340,N'Không có quyền quản trị.',1;
 IF @StockQuantity<0 THROW 50341,N'Tồn kho không được âm.',1;
 IF @VariantID IS NULL BEGIN
  INSERT dbo.ProductVariants(ProductID,SizeID,ColorID,SKU,StockQuantity,IsActive) VALUES(@ProductID,@SizeID,@ColorID,@SKU,@StockQuantity,@IsActive);
  SET @SavedVariantID=SCOPE_IDENTITY();
 END ELSE BEGIN
  UPDATE dbo.ProductVariants SET SizeID=@SizeID,ColorID=@ColorID,SKU=@SKU,StockQuantity=@StockQuantity,IsActive=@IsActive,UpdatedAt=SYSUTCDATETIME() WHERE VariantID=@VariantID AND ProductID=@ProductID;
  IF @@ROWCOUNT=0 THROW 50342,N'Biến thể không tồn tại.',1; SET @SavedVariantID=@VariantID;
 END
 SELECT * FROM dbo.ProductVariants WHERE VariantID=@SavedVariantID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AdjustVariantStock
 @VariantID BIGINT,@QuantityChange INT,@AdminUserID BIGINT
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE UserID=@AdminUserID AND Role='ADMIN' AND IsActive=1) THROW 50350,N'Không có quyền quản trị.',1;
 UPDATE dbo.ProductVariants SET StockQuantity=StockQuantity+@QuantityChange,UpdatedAt=SYSUTCDATETIME() WHERE VariantID=@VariantID AND StockQuantity+@QuantityChange>=0;
 IF @@ROWCOUNT=0 THROW 50351,N'Biến thể không tồn tại hoặc tồn kho sau điều chỉnh bị âm.',1;
 SELECT * FROM dbo.ProductVariants WHERE VariantID=@VariantID;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateProductPrice
    @ProductID BIGINT,
    @NewPrice DECIMAL(18,2),
    @AdminUserID BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @NewPrice IS NULL OR @NewPrice < 0
        THROW 50100, N'Giá sản phẩm không được âm.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserID = @AdminUserID
          AND Role = 'ADMIN'
          AND IsActive = 1
    )
        THROW 50101, N'Chỉ quản trị viên đang hoạt động mới được thay đổi giá.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Products
        WHERE ProductID = @ProductID
    )
        THROW 50102, N'Sản phẩm không tồn tại.', 1;

    DECLARE @PriceChanged BIT = 0;

    UPDATE dbo.Products
    SET Price = @NewPrice,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserID = @AdminUserID
    WHERE ProductID = @ProductID
      AND Price <> @NewPrice;

    IF @@ROWCOUNT > 0
        SET @PriceChanged = 1;

    SELECT
        product.ProductID,
        product.Name,
        product.Price,
        product.UpdatedAt,
        product.UpdatedByUserID,
        @PriceChanged AS PriceChanged
    FROM dbo.Products AS product
    WHERE product.ProductID = @ProductID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateOrderStatus
    @OrderID BIGINT,
    @NewStatus VARCHAR(20),
    @AdminUserID BIGINT,
    @StatusNote NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @NewStatus = UPPER(LTRIM(RTRIM(@NewStatus)));
    SET @StatusNote = NULLIF(LTRIM(RTRIM(@StatusNote)), N'');

    IF @NewStatus IS NULL OR @NewStatus NOT IN ('PREPARING', 'SHIPPING')
        THROW 50110, N'Procedure này chỉ nhận PREPARING hoặc SHIPPING.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserID = @AdminUserID
          AND Role = 'ADMIN'
          AND IsActive = 1
    )
        THROW 50111, N'Chỉ quản trị viên đang hoạt động mới được cập nhật trạng thái đơn.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Orders
        WHERE OrderID = @OrderID
    )
        THROW 50112, N'Đơn hàng không tồn tại.', 1;

    BEGIN TRY
        EXEC sys.sp_set_session_context
            @key = N'StatusNote',
            @value = @StatusNote;

        UPDATE dbo.Orders
        SET Status = @NewStatus,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedByUserID = @AdminUserID
        WHERE OrderID = @OrderID
          AND
          (
              (Status = 'PENDING' AND @NewStatus = 'PREPARING')
              OR
              (Status = 'PREPARING' AND @NewStatus = 'SHIPPING')
          );

        IF @@ROWCOUNT = 0
            THROW 50113, N'Không được chuyển trạng thái theo hướng yêu cầu.', 1;

        EXEC sys.sp_set_session_context
            @key = N'StatusNote',
            @value = NULL;
    END TRY
    BEGIN CATCH
        EXEC sys.sp_set_session_context
            @key = N'StatusNote',
            @value = NULL;

        THROW;
    END CATCH;

    SELECT
        customerOrder.OrderID,
        customerOrder.OrderCode,
        customerOrder.Status,
        customerOrder.UpdatedAt,
        customerOrder.UpdatedByUserID
    FROM dbo.Orders AS customerOrder
    WHERE customerOrder.OrderID = @OrderID;
END;
GO

SELECT
    procedureObject.name AS ProcedureName,
    procedureObject.create_date AS CreatedAt,
    procedureObject.modify_date AS ModifiedAt
FROM sys.procedures AS procedureObject
WHERE procedureObject.name IN
(
    N'sp_UpdateProductPrice',
    N'sp_UpdateOrderStatus'
)
ORDER BY procedureObject.name;
GO
