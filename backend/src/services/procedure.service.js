const { getPool } = require("../db");

async function executeProcedure(name, configure) {
  const pool = await getPool();
  const request = pool.request();
  if (configure) configure(request);
  return request.execute(name);
}

function procedureOutput(result) {
  return { data: result.recordset || [], recordsets: result.recordsets || [], output: result.output || {} };
}

module.exports = { executeProcedure, procedureOutput };
