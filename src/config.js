const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function readEnv(name, fallback = "") {
  const value = process.env[name];
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function requiredEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }
  return value;
}

function readBooleanEnv(name, fallback = false) {
  const value = readEnv(name);

  if (!value) return fallback;

  return ["1", "true", "yes", "sim", "on"].includes(value.toLowerCase());
}

const dbClient = readEnv("DB_CLIENT", readEnv("DATABASE_URL") ? "postgres" : "firebird").toLowerCase();
const isPostgres = dbClient === "postgres" || dbClient === "postgresql";

module.exports = {
  port: Number(readEnv("PORT", "3000")) || 3000,
  db: isPostgres
    ? {
        client: "postgres",
        url: requiredEnv("DATABASE_URL"),
        ssl: readBooleanEnv("DB_SSL", true)
      }
    : {
        client: "firebird",
        host: readEnv("DB_HOST", "127.0.0.1"),
        port: Number(readEnv("DB_PORT", "3050")) || 3050,
        database: requiredEnv("DB_PATH"),
        user: requiredEnv("DB_USER"),
        password: requiredEnv("DB_PASSWORD"),
        lowercase_keys: true,
        pageSize: 4096
      }
};
