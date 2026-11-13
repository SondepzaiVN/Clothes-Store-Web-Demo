require("dotenv").config();
const app = require("./app");
const { closePool } = require("./db");

const port = Number(process.env.PORT || 3001);
const server = app.listen(port, () => {
  console.log(`DECO database API listening at http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal}: shutting down...`);
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
