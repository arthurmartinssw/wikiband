const Firebird = require("node-firebird");
const config = require("../config");

const options = {
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  lowercase_keys: config.db.lowercase_keys,
  pageSize: config.db.pageSize
};

function attach() {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (error, db) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(db);
    });
  });
}

function detach(db) {
  return new Promise((resolve) => {
    db.detach(() => {
      resolve();
    });
  });
}

async function query(sql, params = []) {
  const db = await attach();

  try {
    const rows = await new Promise((resolve, reject) => {
      db.query(sql, params, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(Array.isArray(result) ? result : []);
      });
    });

    return rows;
  } finally {
    await detach(db);
  }
}

module.exports = {
  query
};
