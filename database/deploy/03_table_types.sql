/*
    DECO - User-defined table types

    OrderItemInputType is the cart payload accepted by sp_CreateOrder.
    The client sends only ProductVariantID and Quantity. Prices and totals
    must always be read and calculated again by the database.
*/

USE DECO;
GO

SET NOCOUNT ON;
GO

IF TYPE_ID(N'dbo.OrderItemInputType') IS NULL
BEGIN
    EXEC
    (
        N'CREATE TYPE dbo.OrderItemInputType AS TABLE
        (
            ProductVariantID BIGINT NOT NULL,
            Quantity INT NOT NULL CHECK (Quantity > 0),
            PRIMARY KEY (ProductVariantID)
        );'
    );
END;
GO

/* Verify that the type exists and inspect its columns. */
SELECT
    SCHEMA_NAME(tableType.schema_id) AS SchemaName,
    tableType.name AS TypeName,
    columnDefinition.column_id AS ColumnOrder,
    columnDefinition.name AS ColumnName,
    TYPE_NAME(columnDefinition.user_type_id) AS DataType,
    columnDefinition.max_length AS MaxLength,
    columnDefinition.is_nullable AS IsNullable
FROM sys.table_types AS tableType
INNER JOIN sys.columns AS columnDefinition
    ON columnDefinition.object_id = tableType.type_table_object_id
WHERE tableType.name = N'OrderItemInputType'
  AND SCHEMA_NAME(tableType.schema_id) = N'dbo'
ORDER BY columnDefinition.column_id;
GO

/* Example payload - this does not insert data into any real table. */
DECLARE @ExampleItems dbo.OrderItemInputType;

INSERT INTO @ExampleItems (ProductVariantID, Quantity)
SELECT TOP (2)
    VariantID,
    1
FROM dbo.ProductVariants
WHERE IsActive = 1
  AND StockQuantity > 0
ORDER BY VariantID;

SELECT
    input.ProductVariantID,
    input.Quantity,
    variant.SKU,
    variant.StockQuantity AS CurrentStock
FROM @ExampleItems AS input
INNER JOIN dbo.ProductVariants AS variant
    ON variant.VariantID = input.ProductVariantID;
GO
