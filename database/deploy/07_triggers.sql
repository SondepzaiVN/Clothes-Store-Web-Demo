/*
    trg_Products_PriceHistory:
      Logs every real price change into ProductPriceHistory.
      ChangedByUserID comes from Products.UpdatedByUserID
      (set by sp_UpdateProductPrice).

    trg_Orders_StatusHistory:
      Logs order creation (OldStatus = NULL) and every real status change
      into OrderStatusHistory. ChangedByUserID comes from
      Orders.UpdatedByUserID. Note comes from SESSION_CONTEXT('StatusNote')
      (set by sp_UpdateOrderStatus, sp_CancelOrder and sp_CompleteOrder).
*/

USE DECO;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER TRIGGER dbo.trg_Products_PriceHistory
ON dbo.Products
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(Price)
        RETURN;

    INSERT INTO dbo.ProductPriceHistory
    (
        ProductID,
        OldPrice,
        NewPrice,
        ChangedByUserID
    )
    SELECT
        newRow.ProductID,
        oldRow.Price,
        newRow.Price,
        newRow.UpdatedByUserID
    FROM inserted AS newRow
    INNER JOIN deleted AS oldRow
        ON oldRow.ProductID = newRow.ProductID
    WHERE oldRow.Price <> newRow.Price;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_Orders_StatusHistory
ON dbo.Orders
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StatusNote NVARCHAR(500) =
        TRY_CAST(SESSION_CONTEXT(N'StatusNote') AS NVARCHAR(500));

    INSERT INTO dbo.OrderStatusHistory
    (
        OrderID,
        OldStatus,
        NewStatus,
        ChangedByUserID,
        Note
    )
    SELECT
        newRow.OrderID,
        oldRow.Status,
        newRow.Status,
        CASE
            WHEN oldRow.OrderID IS NULL THEN COALESCE(newRow.UpdatedByUserID, newRow.UserID)
            ELSE newRow.UpdatedByUserID
        END,
        CASE
            WHEN oldRow.OrderID IS NULL THEN N'Tạo đơn hàng'
            ELSE @StatusNote
        END
    FROM inserted AS newRow
    LEFT JOIN deleted AS oldRow
        ON oldRow.OrderID = newRow.OrderID
    WHERE oldRow.OrderID IS NULL
       OR oldRow.Status <> newRow.Status;
END;
GO

SELECT
    triggerObject.name AS TriggerName,
    OBJECT_NAME(triggerObject.parent_id) AS TableName,
    triggerObject.is_disabled AS IsDisabled,
    triggerObject.create_date AS CreatedAt,
    triggerObject.modify_date AS ModifiedAt
FROM sys.triggers AS triggerObject
WHERE triggerObject.name IN
(
    N'trg_Products_PriceHistory',
    N'trg_Orders_StatusHistory'
)
ORDER BY triggerObject.name;
GO
