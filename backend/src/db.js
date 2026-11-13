const sql = require("mssql/msnodesqlv8");

let poolPromise;

function asBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function createConfig() {
  const trustedConnection = asBoolean(process.env.DB_TRUSTED_CONNECTION, true);
  const server = process.env.DB_SERVER || "(local)";
  const database = process.env.DB_NAME || "DECO";
  const odbcDriver = process.env.DB_ODBC_DRIVER || "ODBC Driver 18 for SQL Server";
  const trustCertificate = asBoolean(process.env.DB_TRUST_CERTIFICATE, true);
  const credentials = trustedConnection
    ? "Trusted_Connection=Yes;"
    : `UID=${process.env.DB_USER || ""};PWD=${process.env.DB_PASSWORD || ""};`;

  const config = {
    connectionString:
      `Driver={${odbcDriver}};Server=${server};Database=${database};` +
      `${credentials}Encrypt=No;TrustServerCertificate=${trustCertificate ? "Yes" : "No"};`,
    driver: "msnodesqlv8",
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      trustedConnection,
      trustServerCertificate: asBoolean(process.env.DB_TRUST_CERTIFICATE, true),
      enableArithAbort: true,
    },
  };

  return config;
}

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(createConfig())
      .connect()
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }
  return poolPromise;
}

async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = undefined;
  await pool.close();
}

function nullableText(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return String(value).trim();
}

function addNullableInput(request, name, type, value) {
  request.input(name, type, value === undefined || value === "" ? null : value);
  return request;
}

module.exports = {
  sql,
  getPool,
  closePool,
  nullableText,
  addNullableInput,
};
