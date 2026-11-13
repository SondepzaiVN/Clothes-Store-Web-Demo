/* DECO - SQL Server schema source of truth (14 tables) */
--create database DECO;
--go

SET XACT_ABORT ON;
GO


CREATE TABLE dbo.Users (
    UserID BIGINT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Phone VARCHAR(15) NULL,
    Role VARCHAR(20) NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('CUSTOMER'),
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('CUSTOMER', 'ADMIN'))
);
GO

CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users(Email);
GO

CREATE TABLE dbo.UserAddresses (
    AddressID BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserID BIGINT NOT NULL,
    RecipientName NVARCHAR(100) NOT NULL,
    Phone VARCHAR(15) NOT NULL,
    AddressLine NVARCHAR(500) NOT NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_UserAddresses_IsDefault DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_UserAddresses_IsActive DEFAULT (1),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserAddresses_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_UserAddresses_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE UNIQUE INDEX UX_UserAddresses_Default
ON dbo.UserAddresses(UserID) WHERE IsDefault = 1 AND IsActive = 1;
GO

CREATE TABLE dbo.Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT (1),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT (SYSUTCDATETIME())
);
GO

CREATE UNIQUE INDEX UX_Categories_Name ON dbo.Categories(Name);
GO

CREATE TABLE dbo.Sizes (
    SizeID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(30) NOT NULL,
    SortOrder INT NOT NULL CONSTRAINT DF_Sizes_SortOrder DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Sizes_IsActive DEFAULT (1)
);
GO

CREATE UNIQUE INDEX UX_Sizes_Name ON dbo.Sizes(Name);
GO

CREATE TABLE dbo.Colors (
    ColorID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL,
    HexCode CHAR(7) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Colors_IsActive DEFAULT (1),
    CONSTRAINT CK_Colors_HexCode CHECK (HexCode IS NULL OR HexCode LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);
GO

CREATE UNIQUE INDEX UX_Colors_Name ON dbo.Colors(Name);
GO

CREATE TABLE dbo.Products (
    ProductID BIGINT IDENTITY(1,1) PRIMARY KEY,
    CategoryID INT NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Price DECIMAL(18,2) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Products_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedByUserID BIGINT NULL,
    CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryID) REFERENCES dbo.Categories(CategoryID),
    CONSTRAINT FK_Products_UpdatedBy FOREIGN KEY (UpdatedByUserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE INDEX IX_Products_Filter ON dbo.Products(CategoryID, IsActive, Price) INCLUDE (Name);
GO

CREATE TABLE dbo.ProductImages (
    ImageID BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductID BIGINT NOT NULL,
    ImageUrl NVARCHAR(1000) NOT NULL,
    IsPrimary BIT NOT NULL CONSTRAINT DF_ProductImages_IsPrimary DEFAULT (0),
    SortOrder INT NOT NULL CONSTRAINT DF_ProductImages_SortOrder DEFAULT (0),
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProductImages_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
);
GO

CREATE UNIQUE INDEX UX_ProductImages_Primary ON dbo.ProductImages(ProductID) WHERE IsPrimary = 1;
GO

CREATE TABLE dbo.ProductVariants (
    VariantID BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductID BIGINT NOT NULL,
    SizeID INT NOT NULL,
    ColorID INT NOT NULL,
    SKU VARCHAR(80) NOT NULL,
    StockQuantity INT NOT NULL CONSTRAINT DF_ProductVariants_Stock DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_ProductVariants_IsActive DEFAULT (1),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProductVariants_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_ProductVariants_Stock CHECK (StockQuantity >= 0),
    CONSTRAINT FK_ProductVariants_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT FK_ProductVariants_Sizes FOREIGN KEY (SizeID) REFERENCES dbo.Sizes(SizeID),
    CONSTRAINT FK_ProductVariants_Colors FOREIGN KEY (ColorID) REFERENCES dbo.Colors(ColorID),
    CONSTRAINT UQ_ProductVariants_Combination UNIQUE (ProductID, SizeID, ColorID),
    CONSTRAINT UQ_ProductVariants_SKU UNIQUE (SKU)
);
GO

CREATE TABLE dbo.Vouchers (
    VoucherID BIGINT IDENTITY(1,1) PRIMARY KEY,
    VoucherCode VARCHAR(50) NOT NULL,
    DiscountType VARCHAR(10) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
    MaxDiscount DECIMAL(18,2) NULL,
    MinOrderAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Vouchers_MinOrder DEFAULT (0),
    UsageLimit INT NULL,
    UsedCount INT NOT NULL CONSTRAINT DF_Vouchers_UsedCount DEFAULT (0),
    StartAt DATETIME2(0) NOT NULL,
    EndAt DATETIME2(0) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Vouchers_IsActive DEFAULT (1),
    CONSTRAINT CK_Vouchers_Type CHECK (DiscountType IN ('PERCENT', 'FIXED')),
    CONSTRAINT CK_Vouchers_Value CHECK (DiscountValue > 0 AND MinOrderAmount >= 0 AND (MaxDiscount IS NULL OR MaxDiscount >= 0)),
    CONSTRAINT CK_Vouchers_Usage CHECK (UsedCount >= 0 AND (UsageLimit IS NULL OR (UsageLimit >= 0 AND UsedCount <= UsageLimit))),
    CONSTRAINT CK_Vouchers_Time CHECK (EndAt > StartAt)
);
GO

CREATE UNIQUE INDEX UX_Vouchers_Code ON dbo.Vouchers(VoucherCode);
GO

CREATE TABLE dbo.Orders (
    OrderID BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderCode VARCHAR(30) NOT NULL,
    UserID BIGINT NOT NULL,
    VoucherID BIGINT NULL,
    RecipientName NVARCHAR(100) NOT NULL,
    RecipientPhone VARCHAR(15) NOT NULL,
    ShippingAddress NVARCHAR(500) NOT NULL,
    Subtotal DECIMAL(18,2) NOT NULL,
    ShippingFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_ShippingFee DEFAULT (0),
    DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT (0),
    TotalAmount AS (Subtotal + ShippingFee - DiscountAmount) PERSISTED,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT ('PENDING'),
    Note NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedByUserID BIGINT NULL,
    CONSTRAINT CK_Orders_Amounts CHECK (Subtotal >= 0 AND ShippingFee >= 0 AND DiscountAmount >= 0 AND DiscountAmount <= Subtotal + ShippingFee),
    CONSTRAINT CK_Orders_Status CHECK (Status IN ('PENDING', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT FK_Orders_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Orders_Vouchers FOREIGN KEY (VoucherID) REFERENCES dbo.Vouchers(VoucherID),
    CONSTRAINT FK_Orders_UpdatedBy FOREIGN KEY (UpdatedByUserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE UNIQUE INDEX UX_Orders_Code ON dbo.Orders(OrderCode);
CREATE INDEX IX_Orders_User_CreatedAt ON dbo.Orders(UserID, CreatedAt DESC);
GO

CREATE TABLE dbo.OrderItems (
    OrderItemID BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderID BIGINT NOT NULL,
    ProductVariantID BIGINT NOT NULL,
    ProductNameSnapshot NVARCHAR(200) NOT NULL,
    SizeNameSnapshot NVARCHAR(30) NOT NULL,
    ColorNameSnapshot NVARCHAR(50) NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    LineTotal AS (Quantity * UnitPrice) PERSISTED,
    CONSTRAINT CK_OrderItems_Values CHECK (Quantity > 0 AND UnitPrice >= 0),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID),
    CONSTRAINT FK_OrderItems_Variants FOREIGN KEY (ProductVariantID) REFERENCES dbo.ProductVariants(VariantID)
);
GO

CREATE INDEX IX_OrderItems_OrderID ON dbo.OrderItems(OrderID);
GO

CREATE TABLE dbo.Payments (
    PaymentID BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderID BIGINT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod VARCHAR(20) NOT NULL,
    PaymentStatus VARCHAR(20) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT ('PENDING'),
    TransactionRef VARCHAR(100) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    PaidAt DATETIME2(0) NULL,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_Payments_Method CHECK (PaymentMethod IN ('COD', 'BANK', 'WALLET')),
    CONSTRAINT CK_Payments_Status CHECK (PaymentStatus IN ('PENDING', 'PAID', 'DENIED', 'CANCELLED')),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID)
);
GO

CREATE INDEX IX_Payments_OrderID ON dbo.Payments(OrderID);
CREATE UNIQUE INDEX UX_Payments_TransactionRef ON dbo.Payments(TransactionRef) WHERE TransactionRef IS NOT NULL;
CREATE UNIQUE INDEX UX_Payments_OnePaidPerOrder ON dbo.Payments(OrderID) WHERE PaymentStatus = 'PAID';
GO

CREATE TABLE dbo.ProductPriceHistory (
    PriceHistoryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    ProductID BIGINT NOT NULL,
    OldPrice DECIMAL(18,2) NOT NULL,
    NewPrice DECIMAL(18,2) NOT NULL,
    ChangedByUserID BIGINT NULL,
    ChangedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProductPriceHistory_ChangedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductPriceHistory_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT FK_ProductPriceHistory_Users FOREIGN KEY (ChangedByUserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE INDEX IX_ProductPriceHistory_Product ON dbo.ProductPriceHistory(ProductID, ChangedAt DESC);
GO

CREATE TABLE dbo.OrderStatusHistory (
    StatusHistoryID BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderID BIGINT NOT NULL,
    OldStatus VARCHAR(20) NULL,
    NewStatus VARCHAR(20) NOT NULL,
    ChangedByUserID BIGINT NULL,
    Note NVARCHAR(500) NULL,
    ChangedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderStatusHistory_ChangedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_OrderStatusHistory_Old CHECK (OldStatus IS NULL OR OldStatus IN ('PENDING', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT CK_OrderStatusHistory_New CHECK (NewStatus IN ('PENDING', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT FK_OrderStatusHistory_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID),
    CONSTRAINT FK_OrderStatusHistory_Users FOREIGN KEY (ChangedByUserID) REFERENCES dbo.Users(UserID)
);
GO

CREATE INDEX IX_OrderStatusHistory_Order ON dbo.OrderStatusHistory(OrderID, ChangedAt DESC);
GO
