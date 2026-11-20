const crypto = require("node:crypto");
const { sql, getPool } = require("../db");
const { executeProcedure } = require("./procedure.service");
const embeddingClient = require("./embedding-client.service");
const { parseSearchQuery } = require("./search-query.service");

async function getLookups() {
  const result = await executeProcedure("dbo.sp_GetCatalogLookups");
  return {
    categories: result.recordsets[0] || [],
    sizes: result.recordsets[1] || [],
    colors: result.recordsets[2] || [],
  };
}

function getDocuments(productId = null) {
  return executeProcedure("dbo.sp_GetProductsForEmbedding", (request) => {
    request.input("ProductID", sql.BigInt, productId);
  });
}

function saveEmbedding(document, embedding, modelName, contentHash) {
  return executeProcedure("dbo.sp_UpsertProductEmbedding", (request) => {
    request.input("ProductID", sql.BigInt, document.ProductID);
    request.input("SearchText", sql.NVarChar(sql.MAX), document.SearchText);
    request.input("EmbeddingJson", sql.NVarChar(sql.MAX), JSON.stringify(embedding));
    request.input("ModelName", sql.VarChar(200), modelName);
    request.input("ContentHash", sql.Char(64), contentHash);
  });
}

async function reindexProducts(productId = null, force = false) {
  const result = await getDocuments(productId);
  const documents = result.recordset || [];
  if (documents.length === 0) return { indexed: 0, skipped: 0, total: 0 };

  const candidates = documents.map((document) => ({
    ...document,
    contentHash: crypto.createHash("sha256").update(document.SearchText, "utf8").digest("hex"),
  }));
  const modelName = process.env.EMBEDDING_MODEL || "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
  const pending = candidates.filter((document) => force
    || document.ExistingContentHash !== document.contentHash
    || document.ExistingModelName !== modelName);

  if (pending.length === 0) {
    return { indexed: 0, skipped: candidates.length, total: candidates.length, model: modelName };
  }

  const generated = await embeddingClient.embed(pending.map((document) => document.SearchText));
  if (generated.dimension !== 384 || generated.embeddings.length !== pending.length) {
    const error = new Error("AI service trả về embedding không đúng kích thước hoặc số lượng.");
    error.status = 503;
    throw error;
  }

  for (let index = 0; index < pending.length; index += 1) {
    await saveEmbedding(pending[index], generated.embeddings[index], generated.model, pending[index].contentHash);
  }

  return {
    indexed: pending.length,
    skipped: candidates.length - pending.length,
    total: candidates.length,
    model: generated.model,
  };
}

async function semanticSearch(query, options = {}) {
  const parsed = parseSearchQuery(query, await getLookups());
  const generated = await embeddingClient.embed([parsed.semanticText]);
  const queryEmbedding = generated.embeddings[0];
  if (generated.dimension !== 384 || !queryEmbedding) {
    const error = new Error("AI service không trả về query embedding 384 chiều.");
    error.status = 503;
    throw error;
  }

  const result = await executeProcedure("dbo.sp_SemanticSearchProducts", (request) => {
    request.input("QueryEmbeddingJson", sql.NVarChar(sql.MAX), JSON.stringify(queryEmbedding));
    request.input("CategoryID", sql.Int, parsed.categoryId);
    request.input("CategoryIDs", sql.VarChar(200), parsed.categoryIds.length ? parsed.categoryIds.join(",") : null);
    request.input("SizeID", sql.Int, parsed.sizeId);
    request.input("ColorID", sql.Int, parsed.colorId);
    request.input("MinPrice", sql.Decimal(18, 2), parsed.minPrice);
    request.input("MaxPrice", sql.Decimal(18, 2), parsed.maxPrice);
    request.input("InStock", sql.Bit, parsed.inStock);
    request.input("MinSimilarity", sql.Float, options.minSimilarity || 0);
    request.input("PageNumber", sql.Int, options.page || 1);
    request.input("PageSize", sql.Int, options.pageSize || 20);
  });

  return { result, parsed, model: generated.model };
}

async function status() {
  const [ai, pool] = await Promise.all([embeddingClient.health(), getPool()]);
  const database = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Products WHERE IsActive = 1) AS ActiveProducts,
      (SELECT COUNT(*) FROM dbo.ProductEmbeddings) AS IndexedProducts
  `);
  return { ai, database: database.recordset[0] };
}

module.exports = { parseSearchQuery, semanticSearch, reindexProducts, status };
