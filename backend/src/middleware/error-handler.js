function errorHandler(error, _request, response, _next) {
  const sqlNumber = Number(error.number || error.originalError?.info?.number);
  let status = error.status || 500;
  if (sqlNumber >= 50000 && sqlNumber < 51000) status = 400;
  if ([50101, 50111, 50222, 50240].includes(sqlNumber)) status = 403;
  if ([50102, 50112, 50221, 50241, 50263].includes(sqlNumber)) status = 404;
  if ([50113, 50214, 50225, 50229, 50242, 50247, 50248, 50265, 50268].includes(sqlNumber)) status = 409;
  response.status(status).json({ error: error.message || "Lỗi máy chủ.", sqlNumber: Number.isFinite(sqlNumber) ? sqlNumber : null });
}
module.exports = errorHandler;
