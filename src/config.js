const path = require("path");
const crypto = require("crypto");
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

function readIntegerEnv(name, fallback) {
  const parsed = Number(readEnv(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function normalizeOrigin(origin) {
  const value = String(origin || "").trim();

  if (!value) return "";

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch (error) {
    return "";
  }
}

function readOriginList() {
  const rawOrigins = [
    readEnv("CORS_ORIGINS"),
    readEnv("WIKIBAND_WEB_ORIGIN"),
    readEnv("VERCEL_URL")
  ]
    .filter(Boolean)
    .join(",");

  return [...new Set(rawOrigins.split(",").map(normalizeOrigin).filter(Boolean))];
}

function readSessionSecret(isProduction) {
  const secret = readEnv("SESSION_SECRET");

  if (secret) {
    if (secret.length < 32) {
      throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
    }

    return secret;
  }

  if (isProduction) {
    throw new Error("SESSION_SECRET e obrigatoria em producao.");
  }

  const generatedSecret = crypto.randomBytes(32).toString("hex");
  console.warn("[wikiband] SESSION_SECRET ausente; usando segredo temporario de desenvolvimento.");
  return generatedSecret;
}

const dbClient = readEnv("DB_CLIENT", readEnv("DATABASE_URL") ? "postgres" : "firebird").toLowerCase();
const isPostgres = dbClient === "postgres" || dbClient === "postgresql";
const nodeEnv = readEnv("NODE_ENV", "development").toLowerCase();
const isProduction = nodeEnv === "production";

module.exports = {
  port: Number(readEnv("PORT", "3000")) || 3000,
  env: nodeEnv,
  db: isPostgres
    ? {
        client: "postgres",
        url: requiredEnv("DATABASE_URL"),
        ssl: readBooleanEnv("DB_SSL", true),
        sslRejectUnauthorized: readBooleanEnv("DB_SSL_REJECT_UNAUTHORIZED", true)
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
      },
  security: {
    isProduction,
    sessionSecret: readSessionSecret(isProduction),
    sessionMaxAgeMs: readIntegerEnv("SESSION_MAX_AGE_MS", 1000 * 60 * 60 * 24 * 7),
    corsOrigins: readOriginList()
  }
};
