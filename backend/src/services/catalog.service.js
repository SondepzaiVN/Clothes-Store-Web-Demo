const { sql, nullableText, addNullableInput } = require("../db");
const { executeProcedure } = require("./procedure.service");

function listProducts(filters) {
  return executeProcedure("dbo.sp_GetProducts", (request) => {
    request.input("Keyword", sql.NVarChar(200), nullableText(filters.keyword));
    addNullableInput(request, "CategoryID", sql.Int, filters.categoryId);
    addNullableInput(request, "SizeID", sql.Int, filters.sizeId);
    addNullableInput(request, "ColorID", sql.Int, filters.colorId);
    addNullableInput(request, "MinPrice", sql.Decimal(18, 2), filters.minPrice);
    addNullableInput(request, "MaxPrice", sql.Decimal(18, 2), filters.maxPrice);
    request.input("PageNumber", sql.Int, filters.page);
    request.input("PageSize", sql.Int, filters.pageSize);
  });
}

function getProduct(productId) {
  return executeProcedure("dbo.sp_GetProductDetail", (request) => request.input("ProductID", sql.BigInt, productId));
}

module.exports = { listProducts, getProduct };
