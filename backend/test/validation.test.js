const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../src/app");

test("exports an Express application", () => {
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});

test("API route stack includes health and stored-procedure endpoints", () => {
  const paths = app.locals.apiRoutes;

  assert.ok(paths.includes("/api/health"));
  assert.ok(paths.includes("/api/products"));
  assert.ok(paths.includes("/api/orders"));
  assert.ok(paths.includes("/api/orders/:orderId/cancel"));
  assert.ok(paths.includes("/api/payments/:paymentId/result"));
  assert.ok(paths.includes("/api/admin/products"));
  assert.ok(paths.includes("/api/admin/products/:productId"));
  assert.ok(paths.includes("/api/search/semantic"));
  assert.ok(paths.includes("/api/admin/search/reindex"));
});
