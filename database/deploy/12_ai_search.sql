/*
    DECO - Hybrid semantic product search (SQL Server 2025 / 17.x)

    The embedding model runs outside SQL Server. The application sends a
    JSON array, which is converted to VECTOR(384) inside these procedures.
*/

USE DECO;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.ProductEmbeddings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductEmbeddings
    (
        ProductID BIGINT NOT NULL,
        SearchText NVARCHAR(MAX) NOT NULL,
        Embedding VECTOR(384) NOT NULL,
        ModelName VARCHAR(200) NOT NULL,
        ContentHash CHAR(64) NOT NULL,
        UpdatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_ProductEmbeddings_UpdatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_ProductEmbeddings PRIMARY KEY (ProductID),
        CONSTRAINT FK_ProductEmbeddings_Products
            FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID)
    );
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetProductsForEmbedding
    @ProductID BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @ProductID IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductID = @ProductID)
        THROW 51200, N'Sản phẩm cần tạo embedding không tồn tại.', 1;

    SELECT
        product.ProductID,
        CONCAT
        (
            N'Tên sản phẩm: ', product.Name, N'. ',
            N'Danh mục: ', category.Name, N'. ',
            N'Mô tả: ', COALESCE(product.Description, N''), N'. ',
            N'Màu sắc: ', COALESCE(colorList.ColorNames, N''), N'. ',
            N'Kích cỡ: ', COALESCE(sizeList.SizeNames, N''), N'.'
        ) AS SearchText,
        existing.ContentHash AS ExistingContentHash,
        existing.ModelName AS ExistingModelName
    FROM dbo.Products AS product
    INNER JOIN dbo.Categories AS category
        ON category.CategoryID = product.CategoryID
    OUTER APPLY
    (
        SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), distinctColor.Name), N', ')
                   WITHIN GROUP (ORDER BY distinctColor.Name) AS ColorNames
        FROM
        (
            SELECT DISTINCT color.Name
            FROM dbo.ProductVariants AS variant
            INNER JOIN dbo.Colors AS color ON color.ColorID = variant.ColorID
            WHERE variant.ProductID = product.ProductID
              AND variant.IsActive = 1
              AND color.IsActive = 1
        ) AS distinctColor
    ) AS colorList
    OUTER APPLY
    (
        SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), distinctSize.Name), N', ')
                   WITHIN GROUP (ORDER BY distinctSize.SortOrder, distinctSize.Name) AS SizeNames
        FROM
        (
            SELECT DISTINCT size.Name, size.SortOrder
            FROM dbo.ProductVariants AS variant
            INNER JOIN dbo.Sizes AS size ON size.SizeID = variant.SizeID
            WHERE variant.ProductID = product.ProductID
              AND variant.IsActive = 1
              AND size.IsActive = 1
        ) AS distinctSize
    ) AS sizeList
    LEFT JOIN dbo.ProductEmbeddings AS existing
        ON existing.ProductID = product.ProductID
    WHERE @ProductID IS NULL OR product.ProductID = @ProductID
    ORDER BY product.ProductID;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpsertProductEmbedding
    @ProductID BIGINT,
    @SearchText NVARCHAR(MAX),
    @EmbeddingJson NVARCHAR(MAX),
    @ModelName VARCHAR(200),
    @ContentHash CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductID = @ProductID)
        THROW 51201, N'Sản phẩm cần lưu embedding không tồn tại.', 1;

    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    SET @ModelName = NULLIF(LTRIM(RTRIM(@ModelName)), '');
    SET @ContentHash = NULLIF(LTRIM(RTRIM(@ContentHash)), '');

    IF @SearchText IS NULL OR @ModelName IS NULL OR @ContentHash IS NULL
        THROW 51202, N'Thiếu nội dung, tên model hoặc content hash.', 1;

    DECLARE @Embedding VECTOR(384);

    BEGIN TRY
        SET @Embedding = CONVERT(VECTOR(384), @EmbeddingJson);
    END TRY
    BEGIN CATCH
        THROW 51203, N'Embedding phải là mảng JSON gồm đúng 384 số.', 1;
    END CATCH;

    UPDATE dbo.ProductEmbeddings
    SET SearchText = @SearchText,
        Embedding = @Embedding,
        ModelName = @ModelName,
        ContentHash = @ContentHash,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductID = @ProductID;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO dbo.ProductEmbeddings
            (ProductID, SearchText, Embedding, ModelName, ContentHash)
        VALUES
            (@ProductID, @SearchText, @Embedding, @ModelName, @ContentHash);
    END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_SemanticSearchProducts
    @QueryEmbeddingJson NVARCHAR(MAX),
    @CategoryID INT = NULL,
    @CategoryIDs VARCHAR(200) = NULL,
    @SizeID INT = NULL,
    @ColorID INT = NULL,
    @MinPrice DECIMAL(18,2) = NULL,
    @MaxPrice DECIMAL(18,2) = NULL,
    @InStock BIT = 0,
    @MinSimilarity FLOAT = 0,
    @PageNumber INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize NOT BETWEEN 1 AND 100 SET @PageSize = 20;
    IF @MinPrice IS NOT NULL AND @MinPrice < 0
        THROW 51210, N'Giá tối thiểu không được âm.', 1;
    IF @MaxPrice IS NOT NULL AND @MaxPrice < 0
        THROW 51211, N'Giá tối đa không được âm.', 1;
    IF @MinPrice IS NOT NULL AND @MaxPrice IS NOT NULL AND @MinPrice > @MaxPrice
        THROW 51212, N'Giá tối thiểu không được lớn hơn giá tối đa.', 1;

    DECLARE @QueryEmbedding VECTOR(384);

    BEGIN TRY
        SET @QueryEmbedding = CONVERT(VECTOR(384), @QueryEmbeddingJson);
    END TRY
    BEGIN CATCH
        THROW 51213, N'Query embedding phải là mảng JSON gồm đúng 384 số.', 1;
    END CATCH;

    ;WITH Candidates AS
    (
        SELECT
            product.ProductID,
            product.Name,
            product.Description,
            product.Price,
            product.CategoryID,
            category.Name AS CategoryName,
            product.CreatedAt,
            1.0 - VECTOR_DISTANCE('cosine', embedding.Embedding, @QueryEmbedding) AS SimilarityScore
        FROM dbo.ProductEmbeddings AS embedding
        INNER JOIN dbo.Products AS product ON product.ProductID = embedding.ProductID
        INNER JOIN dbo.Categories AS category ON category.CategoryID = product.CategoryID
        WHERE product.IsActive = 1
          AND category.IsActive = 1
          AND (@CategoryID IS NULL OR product.CategoryID = @CategoryID)
          AND
          (
              @CategoryIDs IS NULL
              OR product.CategoryID IN
              (
                  SELECT TRY_CONVERT(INT, value)
                  FROM STRING_SPLIT(@CategoryIDs, ',')
                  WHERE TRY_CONVERT(INT, value) IS NOT NULL
              )
          )
          AND (@MinPrice IS NULL OR product.Price >= @MinPrice)
          AND (@MaxPrice IS NULL OR product.Price <= @MaxPrice)
          AND
          (
              (@SizeID IS NULL AND @ColorID IS NULL AND @InStock = 0)
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
    ),
    Ranked AS
    (
        SELECT *
        FROM Candidates
        WHERE SimilarityScore >= @MinSimilarity
    )
    SELECT
        ranked.ProductID,
        ranked.Name,
        ranked.Description,
        ranked.Price,
        ranked.CategoryID,
        ranked.CategoryName,
        primaryImage.ImageUrl AS PrimaryImageUrl,
        COALESCE(stock.TotalStock, 0) AS TotalStock,
        CONVERT(DECIMAL(9,6), ranked.SimilarityScore) AS SimilarityScore,
        COUNT(*) OVER() AS TotalCount
    FROM Ranked AS ranked
    OUTER APPLY
    (
        SELECT TOP (1) image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductID = ranked.ProductID
        ORDER BY image.IsPrimary DESC, image.SortOrder, image.ImageID
    ) AS primaryImage
    OUTER APPLY
    (
        SELECT SUM(variant.StockQuantity) AS TotalStock
        FROM dbo.ProductVariants AS variant
        WHERE variant.ProductID = ranked.ProductID
          AND variant.IsActive = 1
    ) AS stock
    ORDER BY ranked.SimilarityScore DESC, ranked.ProductID DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

SELECT name AS ProcedureName
FROM sys.procedures
WHERE name IN
(
    N'sp_GetProductsForEmbedding',
    N'sp_UpsertProductEmbedding',
    N'sp_SemanticSearchProducts'
)
ORDER BY name;
GO
