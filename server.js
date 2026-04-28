const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const config = require("./src/config");
const authRoutes = require("./src/routes/auth");
const itunesRoutes = require("./src/routes/itunes");

const app = express();
const ROOT_DIR = process.cwd();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "up"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/itunes", itunesRoutes);

const staticFiles = express.static(ROOT_DIR);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  staticFiles(req, res, next);
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    next();
    return;
  }

  const normalizedPath = req.path === "/" ? "index" : req.path.replace(/^\/+/, "");
  const candidateHtml = path.join(ROOT_DIR, `${normalizedPath}.html`);

  if (fs.existsSync(candidateHtml)) {
    res.sendFile(candidateHtml);
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

app.listen(config.port, () => {
  console.log(`[wikiband] servidor rodando em http://localhost:${config.port}`);
});
