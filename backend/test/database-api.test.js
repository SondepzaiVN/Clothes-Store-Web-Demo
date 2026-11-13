const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../src/app");
const { closePool, getPool } = require("../src/db");

const runDatabaseTests = process.env.RUN_DB_TESTS === "1";

test("health endpoint connects to DECO", { skip: !runDatabaseTests }, async (context) => {
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  });

  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.DatabaseName, "DECO");
});

test("products endpoint executes sp_GetProducts", { skip: !runDatabaseTests }, async (context) => {
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  });

  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products?page=1&pageSize=5`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
  assert.ok(body.data.length <= 5);
  assert.ok(Object.hasOwn(body.data[0], "ProductID"));
});

test("order read endpoints enforce requester and execute their procedures", { skip: !runDatabaseTests }, async (context) => {
  const pool = await getPool();
  const seed = await pool.request().query(`
    SELECT TOP (1) o.OrderID, o.UserID
    FROM dbo.Orders AS o
    ORDER BY o.OrderID
  `);
  assert.ok(seed.recordset.length > 0);

  const { OrderID: orderId, UserID: userId } = seed.recordset[0];
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  });

  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  const ordersResponse = await fetch(`http://127.0.0.1:${port}/api/users/${userId}/orders?pageSize=5`);
  const ordersBody = await ordersResponse.json();
  assert.equal(ordersResponse.status, 200);
  assert.ok(ordersBody.data.length > 0);

  const detailResponse = await fetch(
    `http://127.0.0.1:${port}/api/orders/${orderId}?requesterUserId=${userId}`,
  );
  const detailBody = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(Number(detailBody.order.OrderID), Number(orderId));
  assert.ok(detailBody.items.length > 0);

  const historyResponse = await fetch(
    `http://127.0.0.1:${port}/api/orders/${orderId}/status-history?requesterUserId=${userId}`,
  );
  const historyBody = await historyResponse.json();
  assert.equal(historyResponse.status, 200);
  assert.ok(historyBody.data.length > 0);
});
