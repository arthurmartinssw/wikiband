// Apple Music "most played" charts for Brazil, returned as raw iTunes lookup objects so the
// frontend can reuse the same result mapping it uses for searches.
const FEED_URL = "https://rss.marketingtools.apple.com/api/v2/br/music/most-played";
const LOOKUP_URL = "https://itunes.apple.com/lookup";
const ALLOWED_TYPES = new Set(["songs", "albums"]);
const LIMIT = 24;
const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 10000;
const cache = new Map();

function sendJson(res, statusCode, payload, cacheControl = "no-store") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.end(JSON.stringify(payload));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

async function loadChart(type) {
  const feed = await fetchJson(`${FEED_URL}/${LIMIT}/${type}.json`);
  const ids = (feed?.feed?.results || []).map((item) => String(item.id || "")).filter((id) => /^\d+$/.test(id));

  if (!ids.length) return [];

  // The feed lacks preview URLs and genres; one lookup call fills them in, then restore chart order.
  const lookup = await fetchJson(`${LOOKUP_URL}?id=${ids.join(",")}&country=br`);
  const byId = new Map(
    (lookup?.results || []).map((item) => [String(type === "songs" ? item.trackId : item.collectionId), item])
  );

  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = async function chartsHandler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
    return;
  }

  const type = new URL(req.url || "/", "http://localhost").searchParams.get("type") || "songs";

  if (!ALLOWED_TYPES.has(type)) {
    sendJson(res, 400, { ok: false, code: "VALIDATION_ERROR", message: "Tipo de ranking invalido." });
    return;
  }

  const cached = cache.get(type);

  try {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      cache.set(type, { at: Date.now(), results: await loadChart(type) });
    }

    sendJson(res, 200, { ok: true, type, results: cache.get(type).results }, "public, s-maxage=1800, stale-while-revalidate=3600");
  } catch (error) {
    console.error("[CHARTS_ERROR]", error.message);

    if (cached) {
      sendJson(res, 200, { ok: true, type, stale: true, results: cached.results }, "public, max-age=300");
      return;
    }

    sendJson(res, 502, { ok: false, code: "CHARTS_UNAVAILABLE", message: "Nao foi possivel carregar o ranking agora." });
  }
};
