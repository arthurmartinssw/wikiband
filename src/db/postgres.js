const { Pool } = require("pg");
const config = require("../config");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.db.url,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
}

async function query(sql, params = []) {
  const result = await getPool().query(sql, params);
  return Array.isArray(result.rows) ? result.rows : [];
}

module.exports = {
  query
};
