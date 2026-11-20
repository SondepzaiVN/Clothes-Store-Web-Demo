/* Run after deploy/12_ai_search.sql and after embeddings have been indexed. */
USE DECO;
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.ProductEmbeddings', N'U') IS NULL
    THROW 51300, N'Chưa triển khai bảng ProductEmbeddings.', 1;

IF OBJECT_ID(N'dbo.sp_SemanticSearchProducts', N'P') IS NULL
    THROW 51301, N'Chưa triển khai sp_SemanticSearchProducts.', 1;

SELECT
    (SELECT COUNT(*) FROM dbo.Products) AS ProductCount,
    (SELECT COUNT(*) FROM dbo.ProductEmbeddings) AS IndexedProductCount;

DECLARE @ExistingEmbedding NVARCHAR(MAX) =
(
    SELECT TOP (1) CONVERT(NVARCHAR(MAX), Embedding)
    FROM dbo.ProductEmbeddings
    ORDER BY ProductID
);

IF @ExistingEmbedding IS NULL
BEGIN
    PRINT N'Chưa có embedding. Chạy npm run ai:reindex trong backend trước khi kiểm thử kết quả.';
END
ELSE
BEGIN
    EXEC dbo.sp_SemanticSearchProducts
        @QueryEmbeddingJson = @ExistingEmbedding,
        @MaxPrice = 500000,
        @InStock = 1,
        @PageNumber = 1,
        @PageSize = 10;
END;
GO
