const express = require("express");
const { createRateLimiter } = require("../middleware/rate-limit");

const router = express.Router();

const ITUNES_BASE_URL = "https://itunes.apple.com";
const ALLOWED_MEDIA = new Set(["music"]);
const ALLOWED_SEARCH_ENTITIES = new Set(["album", "song", "musicArtist"]);
const ALLOWED_LOOKUP_ENTITIES = new Set(["song", "album", "musicArtist"]);
const itunesLimiter = createRateLimiter({
  keyPrefix: "itunes",
  windowMs: 60 * 1000,
  max: 90,
  message: "Muitas buscas em pouco tempo. Aguarde alguns segundos e tente novamente."
});

router.use(itunesLimiter);

function sanitizeText(value) {
  return String(value || "").trim();
}

function parseLimit(rawLimit, fallback = 50) {
  const parsed = Number(rawLimit);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(200, Math.trunc(parsed)));
}

function isValidLookupId(value) {
  return /^\d+(,\d+)*$/.test(value);
}

async function fetchItunes(pathname, searchParams) {
  const url = `${ITUNES_BASE_URL}${pathname}?${searchParams.toString()}`;
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const error = new Error("Falha na API do iTunes.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

router.get("/search", async (req, res) => {
  const term = sanitizeText(req.query.term);
  const media = sanitizeText(req.query.media || "music");
  const entity = sanitizeText(req.query.entity || "album");
  const limit = parseLimit(req.query.limit, 50);

  if (!term) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe o termo de busca."
    });
    return;
  }

  if (!ALLOWED_MEDIA.has(media)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Tipo de midia invalido."
    });
    return;
  }

  if (!ALLOWED_SEARCH_ENTITIES.has(entity)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Tipo de entidade invalido."
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      term,
      media,
      entity,
      limit: String(limit)
    });

    const data = await fetchItunes("/search", params);
    res.status(200).json(data);
  } catch (error) {
    console.error("[ITUNES_SEARCH_ERROR]", error);
    res.status(502).json({
      ok: false,
      code: "ITUNES_UNAVAILABLE",
      message: "Nao foi possivel consultar o iTunes agora."
    });
  }
});

router.get("/lookup", async (req, res) => {
  const id = sanitizeText(req.query.id);
  const entity = sanitizeText(req.query.entity);
  const limit = parseLimit(req.query.limit, 200);

  if (!id || !isValidLookupId(id)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "ID de lookup invalido."
    });
    return;
  }

  if (entity && !ALLOWED_LOOKUP_ENTITIES.has(entity)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Tipo de entidade invalido para lookup."
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      id,
      limit: String(limit)
    });

    if (entity) {
      params.set("entity", entity);
    }

    const data = await fetchItunes("/lookup", params);
    res.status(200).json(data);
  } catch (error) {
    console.error("[ITUNES_LOOKUP_ERROR]", error);
    res.status(502).json({
      ok: false,
      code: "ITUNES_UNAVAILABLE",
      message: "Nao foi possivel consultar o iTunes agora."
    });
  }
});

module.exports = router;
