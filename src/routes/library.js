const express = require("express");
const { createRateLimiter } = require("../middleware/rate-limit");
const { requireUser } = require("../session");
const library = require("../db/library");
const { findUserByUsername } = require("../db/users");

const MAX_LIBRARY_BYTES = 512 * 1024;
const LIST_LIMITS = {
  history: 50,
  albumFavorites: 500,
  bandFavorites: 500,
  plays: 300,
  collections: 100
};
const PUBLIC_ITEM_FIELDS = ["tipo", "nome", "album", "musica", "genero", "lancamento", "albumId", "bandaId", "trackId"];
const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

const libraryLimiter = createRateLimiter({
  keyPrefix: "library",
  windowMs: 5 * 60 * 1000,
  max: 90,
  message: "Muitas sincronizacoes em pouco tempo. Aguarde um instante."
});
const publicProfileLimiter = createRateLimiter({
  keyPrefix: "public-profile",
  windowMs: 60 * 1000,
  max: 60
});

function fail(res, status, code, message) {
  res.status(status).json({ ok: false, code, message });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Returns the cleaned library, or a string describing why it was rejected.
function validateLibrary(dados) {
  if (!isPlainObject(dados)) return "Biblioteca invalida.";

  const cleaned = {};

  for (const [key, limit] of Object.entries(LIST_LIMITS)) {
    const list = dados[key] ?? [];

    if (!Array.isArray(list)) return `Campo ${key} invalido.`;
    if (list.length > limit) return `Campo ${key} tem itens demais (maximo ${limit}).`;

    cleaned[key] = list;
  }

  if (cleaned.collections.some((collection) => !isPlainObject(collection) || !Array.isArray(collection.items ?? []))) {
    return "Colecoes invalidas.";
  }

  if (Buffer.byteLength(JSON.stringify(cleaned)) > MAX_LIBRARY_BYTES) {
    return "Biblioteca grande demais para sincronizar.";
  }

  return cleaned;
}

function publicText(value, maxLength = 160) {
  return String(value ?? "").slice(0, maxLength);
}

function publicImage(value) {
  const url = String(value || "");
  return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url.slice(0, 500) : "";
}

function publicItem(item) {
  if (!isPlainObject(item)) return null;

  const result = { imagem: publicImage(item.imagem) };
  PUBLIC_ITEM_FIELDS.forEach((field) => {
    if (item[field] !== undefined && item[field] !== null) result[field] = publicText(item[field]);
  });
  return result;
}

function publicList(items, limit) {
  return (Array.isArray(items) ? items : []).map(publicItem).filter(Boolean).slice(0, limit);
}

function mapLibraryRow(row) {
  return {
    dados: row?.dados || {},
    publico: Boolean(row?.publico),
    atualizadoEm: row?.atualizado_em ? new Date(row.atualizado_em).getTime() : 0
  };
}

const libraryRouter = express.Router();

libraryRouter.use(libraryLimiter, requireUser);

libraryRouter.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...mapLibraryRow(await library.getLibrary(req.user.id)) });
});

libraryRouter.put("/", async (req, res) => {
  const hasDados = req.body?.dados !== undefined;
  const hasPublico = req.body?.publico !== undefined;

  if (!hasDados && !hasPublico) {
    fail(res, 400, "VALIDATION_ERROR", "Nada para salvar.");
    return;
  }

  if (hasPublico && typeof req.body.publico !== "boolean") {
    fail(res, 400, "VALIDATION_ERROR", "Campo publico invalido.");
    return;
  }

  const dados = hasDados ? validateLibrary(req.body.dados) : null;

  if (typeof dados === "string") {
    fail(res, 400, "VALIDATION_ERROR", dados);
    return;
  }

  const row = await library.saveLibrary(req.user.id, dados, hasPublico ? req.body.publico : null);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...mapLibraryRow(row) });
});

const usersRouter = express.Router();

usersRouter.get("/:username", publicProfileLimiter, async (req, res) => {
  const username = String(req.params.username || "").trim().toLowerCase();
  const user = USERNAME_REGEX.test(username) ? await findUserByUsername(username) : null;
  const row = user ? await library.getLibrary(user.id) : null;

  // Same answer for "does not exist" and "is private", so profiles cannot be enumerated.
  if (!row?.publico) {
    fail(res, 404, "PROFILE_NOT_FOUND", "Perfil nao encontrado ou privado.");
    return;
  }

  const dados = row.dados || {};

  res.set("Cache-Control", "public, max-age=60");
  res.json({
    ok: true,
    profile: {
      nome: publicText(user.nome, 80),
      username,
      membroDesde: user.criado_em || null,
      albumFavorites: publicList(dados.albumFavorites, 48),
      bandFavorites: publicList(dados.bandFavorites, 48),
      collections: (Array.isArray(dados.collections) ? dados.collections : []).slice(0, 24).map((collection) => ({
        name: publicText(collection?.name, 80),
        items: publicList((collection?.items || []).map((saved) => saved?.item), 48)
      }))
    }
  });
});

module.exports = {
  libraryRouter,
  usersRouter,
  validateLibrary
};
