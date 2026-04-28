const config = require("../config");

if (config.db.client === "postgres") {
  module.exports = require("./postgres");
} else {
  module.exports = require("./firebird");
}
