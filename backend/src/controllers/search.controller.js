const search = require("../services/search.service");
const { nullableNumber, positiveInteger } = require("../validators/common");
const { procedureOutput } = require("../services/procedure.service");

async function semantic(request, response, next) {
  try {
    const { result, parsed, model } = await search.semanticSearch(request.body.query, {
      page: nullableNumber(request.body.page) || 1,
      pageSize: nullableNumber(request.body.pageSize) || 20,
      minSimilarity: nullableNumber(request.body.minSimilarity) || 0,
    });
    response.json({ ...procedureOutput(result), query: request.body.query, parsed, model });
  } catch (error) { next(error); }
}

async function reindex(request, response, next) {
  try {
    positiveInteger(request.body.adminUserId, "adminUserId");
    const productId = request.body.productId === undefined || request.body.productId === null
      ? null
      : positiveInteger(request.body.productId, "productId");
    const result = await search.reindexProducts(productId, request.body.force === true);
    response.json(result);
  } catch (error) { next(error); }
}

async function health(_request, response, next) {
  try { response.json({ ok: true, ...(await search.status()) }); }
  catch (error) { next(error); }
}

module.exports = { semantic, reindex, health };
