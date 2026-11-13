/*
    DECO - Index evidence for the report/demo.

    Run in SSMS. Open the Messages tab for STATISTICS IO/TIME. Optionally press
    Ctrl+M before Execute to capture the actual execution plans as screenshots.
    INDEX(0) is used only to create an educational scan baseline; application
    queries must not force it.
*/

USE DECO;
GO

SET NOCOUNT ON;

DECLARE @CategoryID INT =
    (SELECT TOP (1) CategoryID FROM dbo.Products WHERE IsActive = 1 ORDER BY CategoryID);
DECLARE @UserID BIGINT =
    (SELECT TOP (1) UserID FROM dbo.Orders ORDER BY UserID);
DECLARE @ProductID BIGINT =
    (SELECT TOP (1) ProductID FROM dbo.ProductPriceHistory ORDER BY ProductID);
DECLARE @OrderID BIGINT =
    (SELECT TOP (1) OrderID FROM dbo.OrderStatusHistory ORDER BY OrderID);

IF @CategoryID IS NULL OR @UserID IS NULL
    THROW 51200, N'Cần chạy seed dữ liệu trước khi đo index.', 1;

DECLARE @UsageBefore TABLE
(
    IndexName SYSNAME PRIMARY KEY,
    UserSeeks BIGINT,
    UserScans BIGINT,
    UserLookups BIGINT
);

INSERT INTO @UsageBefore
SELECT
    indexObject.name,
    ISNULL(usageStats.user_seeks, 0),
    ISNULL(usageStats.user_scans, 0),
    ISNULL(usageStats.user_lookups, 0)
FROM sys.indexes AS indexObject
LEFT JOIN sys.dm_db_index_usage_stats AS usageStats
    ON usageStats.database_id = DB_ID()
   AND usageStats.object_id = indexObject.object_id
   AND usageStats.index_id = indexObject.index_id
WHERE indexObject.object_id IN
(
    OBJECT_ID(N'dbo.Products'),
    OBJECT_ID(N'dbo.Orders'),
    OBJECT_ID(N'dbo.ProductPriceHistory'),
    OBJECT_ID(N'dbo.OrderStatusHistory')
)
AND indexObject.name IN
(
    N'IX_Products_Filter',
    N'IX_Orders_User_CreatedAt',
    N'IX_ProductPriceHistory_Product',
    N'IX_OrderStatusHistory_Order'
);

SET STATISTICS IO ON;
SET STATISTICS TIME ON;

/* A. Product filter: compare scan baseline with IX_Products_Filter. */
SELECT ProductID, Name, Price
FROM dbo.Products WITH (INDEX(0))
WHERE CategoryID = @CategoryID
  AND IsActive = 1
  AND Price BETWEEN 100000 AND 1000000
ORDER BY Price, ProductID;

SELECT ProductID, Name, Price
FROM dbo.Products WITH (INDEX(IX_Products_Filter))
WHERE CategoryID = @CategoryID
  AND IsActive = 1
  AND Price BETWEEN 100000 AND 1000000
ORDER BY Price, ProductID;

/* B. Customer order history: most recent orders for one user. */
SELECT TOP (20) OrderID, OrderCode, Status, TotalAmount, CreatedAt
FROM dbo.Orders WITH (INDEX(IX_Orders_User_CreatedAt))
WHERE UserID = @UserID
ORDER BY CreatedAt DESC;

/* C. Audit pages: newest history rows for a selected entity. */
IF @ProductID IS NOT NULL
BEGIN
    SELECT TOP (20) PriceHistoryID, OldPrice, NewPrice, ChangedByUserID, ChangedAt
    FROM dbo.ProductPriceHistory WITH (INDEX(IX_ProductPriceHistory_Product))
    WHERE ProductID = @ProductID
    ORDER BY ChangedAt DESC;
END;

IF @OrderID IS NOT NULL
BEGIN
    SELECT TOP (20) StatusHistoryID, OldStatus, NewStatus, ChangedByUserID, Note, ChangedAt
    FROM dbo.OrderStatusHistory WITH (INDEX(IX_OrderStatusHistory_Order))
    WHERE OrderID = @OrderID
    ORDER BY ChangedAt DESC;
END;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;

/* Index definitions and usage change during this session. */
SELECT
    OBJECT_NAME(indexObject.object_id) AS TableName,
    indexObject.name AS IndexName,
    indexObject.type_desc AS IndexType,
    indexObject.is_unique AS IsUnique,
    indexObject.is_disabled AS IsDisabled,
    ISNULL(usageStats.user_seeks, 0) - ISNULL(beforeStats.UserSeeks, 0) AS NewSeeks,
    ISNULL(usageStats.user_scans, 0) - ISNULL(beforeStats.UserScans, 0) AS NewScans,
    ISNULL(usageStats.user_lookups, 0) - ISNULL(beforeStats.UserLookups, 0) AS NewLookups
FROM sys.indexes AS indexObject
LEFT JOIN sys.dm_db_index_usage_stats AS usageStats
    ON usageStats.database_id = DB_ID()
   AND usageStats.object_id = indexObject.object_id
   AND usageStats.index_id = indexObject.index_id
LEFT JOIN @UsageBefore AS beforeStats ON beforeStats.IndexName = indexObject.name
WHERE indexObject.name IN
(
    N'IX_Products_Filter',
    N'IX_Orders_User_CreatedAt',
    N'IX_ProductPriceHistory_Product',
    N'IX_OrderStatusHistory_Order'
)
ORDER BY TableName, IndexName;
GO
