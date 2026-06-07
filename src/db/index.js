const config = require("../config");

if (config.db.client !== "postgres") {
  throw new Error("DB_CLIENT deve ser postgres no build publico.");
}

module.exports = require("./postgres");
