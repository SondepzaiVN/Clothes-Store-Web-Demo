const express = require("express");
const cors = require("cors");
const catalogRoutes = require("./routes/catalog.routes");
const orderRoutes = require("./routes/order.routes");
const orderController = require("./controllers/order.controller");
const misc = require("./controllers/misc.controller");
const adminRoutes = require("./routes/admin.routes");
const searchRoutes = require("./routes/search.routes");
const errorHandler = require("./middleware/error-handler");

const app = express();
app.locals.apiRoutes = [
  "/api/health", "/api/products", "/api/products/:productId", "/api/orders",
  "/api/orders/:orderId/cancel", "/api/users/:userId/orders",
  "/api/admin/products", "/api/admin/products/:productId", "/api/admin/variants", "/api/admin/orders",
  "/api/payments/:paymentId/result", "/api/payments/:paymentId/simulate-webhook",
  "/api/search/semantic", "/api/search/health", "/api/admin/search/reindex",
];
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", misc.health);
app.get("/api/catalog/lookups", require("./controllers/admin.controller").lookups);
app.use("/api/admin", adminRoutes);
app.use("/api/products", catalogRoutes);
app.use("/api/search", searchRoutes);
app.patch("/api/products/:productId/price", misc.updatePrice);
app.get("/api/products/:productId/price-history", misc.priceHistory);
app.use("/api/orders", orderRoutes);
app.get("/api/orders/:orderId/status-history", misc.statusHistory);
app.get("/api/users/:userId/orders", orderController.listForUser);
app.post("/api/payments/:paymentId/result", misc.paymentResult);
app.post("/api/payments/:paymentId/simulate-webhook", misc.simulateWebhook);

app.use(errorHandler);
module.exports = app;
