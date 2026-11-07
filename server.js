const path = require("path");
const express = require("express");
const cors = require("cors");
const config = require("./src/config");
const authRoutes = require("./src/routes/auth");
const itunesRoutes = require("./src/routes/itunes");
const { libraryRouter } = require("./src/routes/library");
const { feedRouter, usersRouter } = require("./src/routes/users");
const { migrate } = require("./src/db/library");
const social = require("./src/db/social");
const { isDatabaseConnectionError } = require("./src/db/errors");
// Vercel serverless handlers, mounted here so local dev and non-Vercel hosts serve them too.
const musicAiHandler = require("./api/musicai");
const chartsHandler = require("./api/charts");

const app = express();
const ROOT_DIR = process.cwd();
const PAGE_ROUTES = new Map([
  ["/", "index.html"],
  ["/index", "index.html"],
  ["/login", "login.html"],
  ["/cadastro", "cadastro.html"],
  ["/favoritos", "favoritos.html"],
  ["/perfil", "perfil.html"],
  ["/banda", "banda.html"],
  ["/sobre", "sobre.html"],
  ["/usuario", "usuario.html"],
  ["/comunidade", "comunidade.html"],
  ["/retrospectiva", "retrospectiva.html"],
  ["/offline", "offline.html"]
]);
const PUBLIC_FILES = new Set([
  "/index.html",
  "/login.html",
  "/cadastro.html",
  "/favoritos.html",
  "/perfil.html",
  "/banda.html",
  "/sobre.html",
  "/usuario.html",
  "/comunidade.html",
  "/retrospectiva.html",
  "/offline.html",
  "/service-worker.js",
  "/site.webmanifest",
  "/favicon.ico"
]);
const PUBLIC_PREFIXES = ["/assets/"];

app.disable("x-powered-by");
app.set("trust proxy", 1);

function normalizeOrigin(origin) {
  const value = String(origin || "").trim();

  if (!value) return "";

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch (error) {
    return "";
  }
}

function isCorsOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  if (config.security.corsOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return (
    !config.security.isProduction &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  );
}

function securityHeaders(req, res, next) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://itunes.apple.com https://pt.wikipedia.org https://en.wikipedia.org",
    "media-src 'self' https: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (config.security.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
}

function isPublicStaticRequest(req) {
  if (!["GET", "HEAD"].includes(req.method)) {
    return false;
  }

  const requestPath = req.path;
  const normalizedPath = path.posix.normalize(requestPath);

  if (normalizedPath !== requestPath) {
    return false;
  }

  return PUBLIC_FILES.has(requestPath) || PUBLIC_PREFIXES.some((prefix) => requestPath.startsWith(prefix));
}

app.use(securityHeaders);

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  })
);
// The synced library is larger than other payloads; body-parser skips bodies already parsed.
app.use("/api/library", express.json({ limit: "600kb" }));
app.use(express.json({ limit: "64kb" }));
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      ok: false,
      code: "INVALID_JSON",
      message: "JSON invalido."
    });
    return;
  }

  next(error);
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "up"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/itunes", itunesRoutes);
app.use("/api/library", libraryRouter);
app.use("/api/users", usersRouter);
app.use("/api/feed", feedRouter);
app.all("/api/musicai", musicAiHandler);
app.get("/api/charts", chartsHandler);

const staticFiles = express.static(ROOT_DIR, {
  dotfiles: "deny",
  fallthrough: true,
  index: false,
  redirect: false
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (isPublicStaticRequest(req)) {
    staticFiles(req, res, next);
    return;
  }

  next();
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    next();
    return;
  }

  const pageFile = PAGE_ROUTES.get(req.path);

  if (pageFile) {
    res.sendFile(path.join(ROOT_DIR, pageFile));
    return;
  }

  if (path.extname(req.path)) {
    next();
    return;
  }

  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    code: "NOT_FOUND",
    message: "Rota nao encontrada."
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error?.type === "entity.too.large") {
    res.status(413).json({ ok: false, code: "PAYLOAD_TOO_LARGE", message: "Corpo da requisicao muito grande." });
    return;
  }

  if (isDatabaseConnectionError(error)) {
    res.status(503).json({ ok: false, code: "DATABASE_UNAVAILABLE", message: "Nao foi possivel conectar ao banco de dados." });
    return;
  }

  console.error("[WIKIBAND_ERROR]", req.method, req.path, error);
  res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Algo deu errado. Tente novamente em instantes." });
});

if (require.main === module) {
  migrate()
    .then(social.migrate)
    .catch((error) => {
      console.error("[wikiband] nao foi possivel preparar as tabelas:", error.message);
    });

  app.listen(config.port, () => {
    console.log(`[wikiband] servidor rodando em http://localhost:${config.port}`);
  });
}

module.exports = app;
