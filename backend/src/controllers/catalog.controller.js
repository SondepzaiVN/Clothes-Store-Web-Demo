const catalog = require("../services/catalog.service");
const { procedureOutput } = require("../services/procedure.service");
const { nullableNumber, positiveInteger } = require("../validators/common");

async function list(request, response, next) {
  try {
    const result = await catalog.listProducts({
      keyword: request.query.keyword,
      categoryId: nullableNumber(request.query.categoryId), sizeId: nullableNumber(request.query.sizeId),
      colorId: nullableNumber(request.query.colorId), minPrice: nullableNumber(request.query.minPrice),
      maxPrice: nullableNumber(request.query.maxPrice), page: nullableNumber(request.query.page) || 1,
      pageSize: nullableNumber(request.query.pageSize) || 20,
    });
    response.json(procedureOutput(result));
  } catch (error) { next(error); }
}

async function detail(request, response, next) {
  try {
    const result = await catalog.getProduct(positiveInteger(request.params.productId, "productId"));
    response.json({ product: result.recordsets[0]?.[0] || null, images: result.recordsets[1] || [], variants: result.recordsets[2] || [] });
  } catch (error) { next(error); }
}

module.exports = { list, detail };
