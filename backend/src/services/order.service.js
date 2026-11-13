const { sql, nullableText } = require("../db");
const { executeProcedure } = require("./procedure.service");

function createOrder(body) {
  const items = new sql.Table("dbo.OrderItemInputType");
  items.columns.add("ProductVariantID", sql.BigInt, { nullable: false });
  items.columns.add("Quantity", sql.Int, { nullable: false });
  body.items.forEach((item) => items.rows.add(item.productVariantId, item.quantity));
  return executeProcedure("dbo.sp_CreateOrder", (request) => {
    request.input("UserID", sql.BigInt, body.userId);
    request.input("RecipientName", sql.NVarChar(100), body.recipientName);
    request.input("RecipientPhone", sql.VarChar(15), body.recipientPhone);
    request.input("ShippingAddress", sql.NVarChar(500), body.shippingAddress);
    request.input("Items", items);
    request.input("VoucherCode", sql.VarChar(50), nullableText(body.voucherCode));
    request.input("PaymentMethod", sql.VarChar(20), body.paymentMethod || "COD");
    request.input("ShippingFee", sql.Decimal(18, 2), 30000);
    request.input("Note", sql.NVarChar(500), nullableText(body.note));
    request.output("OrderID", sql.BigInt);
    request.output("OrderCode", sql.VarChar(30));
  });
}

function cancelOrder(orderId, userId, note) {
  return executeProcedure("dbo.sp_CancelOrder", (request) => {
    request.input("OrderID", sql.BigInt, orderId);
    request.input("RequestedByUserID", sql.BigInt, userId);
    request.input("StatusNote", sql.NVarChar(500), nullableText(note));
  });
}

function updateStatus(orderId, body) {
  return executeProcedure("dbo.sp_UpdateOrderStatus", (request) => {
    request.input("OrderID", sql.BigInt, orderId);
    request.input("NewStatus", sql.VarChar(20), body.status);
    request.input("AdminUserID", sql.BigInt, body.adminUserId);
    request.input("StatusNote", sql.NVarChar(500), nullableText(body.note));
  });
}

function completeOrder(orderId, body) {
  return executeProcedure("dbo.sp_CompleteOrder", (request) => {
    request.input("OrderID", sql.BigInt, orderId);
    request.input("AdminUserID", sql.BigInt, body.adminUserId);
    request.input("ConfirmCODCollected", sql.Bit, Boolean(body.confirmCODCollected));
    request.input("StatusNote", sql.NVarChar(500), nullableText(body.note));
  });
}

function listUserOrders(userId, status, page, pageSize) {
  return executeProcedure("dbo.sp_GetUserOrders", (request) => {
    request.input("UserID", sql.BigInt, userId);
    request.input("Status", sql.VarChar(20), nullableText(status));
    request.input("PageNumber", sql.Int, page);
    request.input("PageSize", sql.Int, pageSize);
  });
}

function getOrder(orderId, requesterUserId) {
  return executeProcedure("dbo.sp_GetOrderDetail", (request) => {
    request.input("OrderID", sql.BigInt, orderId);
    request.input("RequestedByUserID", sql.BigInt, requesterUserId);
  });
}

module.exports = { createOrder, cancelOrder, updateStatus, completeOrder, listUserOrders, getOrder };
