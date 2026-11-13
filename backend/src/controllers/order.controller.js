const orders = require("../services/order.service");
const { procedureOutput } = require("../services/procedure.service");
const { nullableNumber, positiveInteger, requiredText } = require("../validators/common");

function validateItems(items) {
  if (!Array.isArray(items) || !items.length) { const error = new Error("items phải chứa ít nhất một sản phẩm."); error.status = 400; throw error; }
  return items.map((item) => ({ productVariantId: positiveInteger(item.productVariantId, "productVariantId"), quantity: positiveInteger(item.quantity, "quantity") }));
}

async function create(request, response, next) {
  try {
    const body = request.body || {};
    const result = await orders.createOrder({ ...body, userId: positiveInteger(body.userId, "userId"), recipientName: requiredText(body.recipientName, "recipientName"), recipientPhone: requiredText(body.recipientPhone, "recipientPhone"), shippingAddress: requiredText(body.shippingAddress, "shippingAddress"), items: validateItems(body.items) });
    response.status(201).json(procedureOutput(result));
  } catch (error) { next(error); }
}

async function cancel(request, response, next) {
  try { response.json(procedureOutput(await orders.cancelOrder(positiveInteger(request.params.orderId, "orderId"), positiveInteger(request.body.userId, "userId"), request.body.note))); } catch (error) { next(error); }
}

async function updateStatus(request, response, next) {
  try { response.json(procedureOutput(await orders.updateStatus(positiveInteger(request.params.orderId, "orderId"), { ...request.body, adminUserId: positiveInteger(request.body.adminUserId, "adminUserId") }))); } catch (error) { next(error); }
}

async function complete(request, response, next) {
  try { response.json(procedureOutput(await orders.completeOrder(positiveInteger(request.params.orderId, "orderId"), { ...request.body, adminUserId: positiveInteger(request.body.adminUserId, "adminUserId") }))); } catch (error) { next(error); }
}

async function listForUser(request, response, next) {
  try { response.json(procedureOutput(await orders.listUserOrders(positiveInteger(request.params.userId, "userId"), request.query.status, nullableNumber(request.query.page) || 1, nullableNumber(request.query.pageSize) || 20))); } catch (error) { next(error); }
}

async function detail(request, response, next) {
  try {
    const result = await orders.getOrder(positiveInteger(request.params.orderId, "orderId"), positiveInteger(request.query.requesterUserId, "requesterUserId"));
    response.json({ order: result.recordsets[0]?.[0] || null, items: result.recordsets[1] || [], payments: result.recordsets[2] || [] });
  } catch (error) { next(error); }
}

module.exports = { create, cancel, updateStatus, complete, listForUser, detail };
