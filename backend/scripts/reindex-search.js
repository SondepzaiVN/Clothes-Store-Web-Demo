require("dotenv").config();

const search = require("../src/services/search.service");
const { closePool } = require("../src/db");

async function main() {
  const result = await search.reindexProducts(null, process.argv.includes("--force"));
  console.log(`Indexed ${result.indexed}/${result.total}; skipped ${result.skipped}; model ${result.model}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
