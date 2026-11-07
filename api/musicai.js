const { AiError, getProvider } = require("./_lib/ai");

const MAX_BODY_BYTES = 32 * 1024;
const MAX_REPLY_CHARS = 1800;
const MAX_MESSAGE_CHARS = 1600;
const MAX_CONTEXT_CHARS = 7000;
const TIMEOUT_MS = 15000;
const PLAYLIST_MIN_TRACKS = 8;
const PLAYLIST_MAX_TRACKS = 15;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = Math.max(5, Math.min(120, Number(process.env.MUSICAI_RATE_LIMIT_MAX) || 30));
const rateStore = new Map();

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMultilineText(value, maxLength = MAX_MESSAGE_CHARS) {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(compactText)
    .filter(Boolean)
    .join("\n")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function stripReasoning(value) {
  return cleanMultilineText(
    String(value || "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^\s*(raciocinio|pensamento|thinking)\s*:?\s*/i, ""),
    MAX_REPLY_CHARS
  );
}

function truncateText(value, maxLength = 180) {
  const text = compactText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function getClientKey(req) {
  const forwarded = getHeader(req, "x-forwarded-for").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function pruneRateStore(now) {
  if (rateStore.size < 1000) return;

  for (const [key, bucket] of rateStore.entries()) {
    if (now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
      rateStore.delete(key);
    }
  }
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = getClientKey(req);
  const bucket = rateStore.get(key);

  pruneRateStore(now);

  if (!bucket || now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    rateStore.set(key, { startedAt: now, count: 1 });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }

  bucket.count += 1;
  return true;
}

async function readJsonBody(req) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > MAX_BODY_BYTES) {
      const error = new Error("BODY_TOO_LARGE");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }

    return req.body.length ? JSON.parse(req.body.toString("utf8")) : {};
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_BODY_BYTES) {
      const error = new Error("BODY_TOO_LARGE");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body.trim() ? JSON.parse(body) : {};
}

function pickObjectFields(source, fields) {
  if (!source || typeof source !== "object") return null;

  const result = {};
  fields.forEach((field) => {
    const value = source[field];
    if (value === null || value === undefined || value === "") return;
    result[field] = truncateText(value, 220);
  });

  return Object.keys(result).length ? result : null;
}

function topLabels(entries, limit = 5) {
  return Array.isArray(entries)
    ? entries
        .map((entry) => entry?.label || entry?.nome || entry?.name || "")
        .map((label) => truncateText(label, 80))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function sanitizeArray(items, limit = 8, maxLength = 180) {
  return Array.isArray(items)
    ? items.map((item) => truncateText(item, maxLength)).filter(Boolean).slice(0, limit)
    : [];
}

function sanitizeFavorites(items, limit = 5) {
  return Array.isArray(items)
    ? items
        .map((item) => {
          if (typeof item === "string") return truncateText(item, 100);
          return truncateText([item?.nome, item?.album, item?.musica, item?.genero].filter(Boolean).join(" - "), 120);
        })
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function sanitizeContext(context) {
  const source = context && typeof context === "object" ? context : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? source.dashboard : {};
  const totals = dashboard.totals && typeof dashboard.totals === "object" ? dashboard.totals : {};

  const sanitized = {
    page: truncateText(source.page, 40),
    searchType: truncateText(source.searchType, 30),
    searchTerm: truncateText(source.searchTerm, 120),
    statusText: truncateText(source.statusText, 180),
    selectedItem: pickObjectFields(source.selectedItem, [
      "tipo",
      "nome",
      "album",
      "musica",
      "genero",
      "pais",
      "lancamento"
    ]),
    visibleResults: sanitizeArray(source.visibleResults, 8, 180),
    favorites: {
      albums: sanitizeFavorites(source.albumFavorites, 5),
      bands: sanitizeFavorites(source.bandFavorites, 5),
      collectionsCount: Array.isArray(source.collections) ? source.collections.length : 0
    },
    dashboard: {
      totals: {
        albumFavorites: Number(totals.albumFavorites || 0),
        bandFavorites: Number(totals.bandFavorites || 0),
        collections: Number(totals.collections || 0),
        plays: Number(totals.plays || 0)
      },
      topGenres: topLabels(dashboard.topGenres, 5),
      topArtists: topLabels(dashboard.topArtists, 5),
      topDecades: topLabels(dashboard.topDecades, 4)
    }
  };

  return JSON.parse(JSON.stringify(sanitized));
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: cleanMultilineText(entry?.content || entry?.text || "", 900)
    }))
    .filter((entry) => entry.content)
    .slice(-8);
}

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return [
    "Voce e a MusicAI, curadora musical do Wikiband, uma vitrine para conhecer artistas, albuns e musicas.",
    `Hoje e ${today}.`,
    "Responda em portugues do Brasil, com tom caloroso, direto e util, como um amigo que entende muito de musica.",
    "Use o contexto da pagina, os resultados visiveis, os favoritos e o historico da conversa para entender o alvo da pergunta.",
    "Se a pessoa perguntar por integrantes, membros, formacao, vocalista, guitarrista, baixista ou baterista e houver artista no contexto, responda sobre esse artista. Nunca trate essas palavras como nome do artista.",
    "Ao recomendar, cite artista e obra concretos e explique em poucas palavras por que combinam com o gosto da pessoa.",
    "Voce pode sugerir recursos do site: buscar artistas, tocar previas, favoritar, criar colecoes e pedir uma playlist (ex.: 'monte uma playlist de rock nacional').",
    "Nao diga que pesquisou em API, iTunes, backend, dados fornecidos ou contexto, a menos que a pessoa pergunte sobre isso.",
    "Nao mostre raciocinio interno, tags de pensamento ou passos ocultos.",
    "Pode usar conhecimento musical geral, mas nao invente fatos especificos (datas, premios, integrantes): quando nao tiver certeza, diga isso de forma simples.",
    "Prefira respostas com 2 a 5 frases curtas. Use lista curta somente quando ajudar, como albuns ou faixas para comecar. Use **negrito** para nomes importantes."
  ].join(" ");
}

function buildPlaylistMessages({ message, context }) {
  const contextText = JSON.stringify(context).slice(0, MAX_CONTEXT_CHARS);

  return [
    {
      role: "system",
      content: [
        "Voce e a MusicAI, curadora musical do Wikiband.",
        `Monte uma playlist com ${PLAYLIST_MIN_TRACKS} a ${PLAYLIST_MAX_TRACKS} musicas reais e conhecidas que existam no catalogo da Apple Music.`,
        "Varie os artistas (no maximo 2 musicas por artista), a menos que a pessoa peca um artista especifico.",
        "Responda SOMENTE com JSON valido neste formato:",
        '{"title":"nome curto da playlist","description":"uma frase sobre o clima","tracks":[{"artist":"Artista","title":"Musica"}]}'
      ].join(" ")
    },
    { role: "user", content: `Contexto do usuario no Wikiband: ${contextText}` },
    { role: "user", content: `Pedido: ${message}` }
  ];
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function parsePlaylist(rawText) {
  const data = extractJsonObject(String(rawText || "").replace(/<think>[\s\S]*?<\/think>/gi, ""));
  const seen = new Set();
  const tracks = (Array.isArray(data?.tracks) ? data.tracks : [])
    .map((track) => ({
      artist: truncateText(track?.artist, 80),
      title: truncateText(track?.title, 100)
    }))
    .filter((track) => {
      const key = `${track.artist}|${track.title}`.toLowerCase();
      if (!track.artist || !track.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, PLAYLIST_MAX_TRACKS);

  if (!tracks.length) return null;

  return {
    title: truncateText(data?.title, 60) || "Playlist da MusicAI",
    description: truncateText(data?.description, 160),
    tracks
  };
}

function buildMessages({ message, context, history }) {
  const contextText = JSON.stringify(context).slice(0, MAX_CONTEXT_CHARS);

  return [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: `Contexto atual do Wikiband para a conversa: ${contextText}`
    },
    ...history,
    { role: "user", content: message }
  ];
}

async function callAi({ messages, json = false, maxTokens = 560, temperature = 0.65 }) {
  const provider = getProvider();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await provider.chat({ messages, temperature, maxTokens, json, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Browsers send Origin on cross-site POSTs; refuse other sites spending our AI quota.
function isForeignOrigin(req) {
  const origin = getHeader(req, "origin");
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost !== getHeader(req, "x-forwarded-host") && originHost !== getHeader(req, "host");
  } catch (error) {
    return true;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
    return;
  }

  if (isForeignOrigin(req)) {
    sendJson(res, 403, { ok: false, code: "FORBIDDEN_ORIGIN", message: "Origem nao permitida." });
    return;
  }

  if (!checkRateLimit(req)) {
    sendJson(res, 429, {
      ok: false,
      code: "LOCAL_RATE_LIMIT",
      message: "MusicAI recebeu muitas mensagens em pouco tempo."
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const message = cleanMultilineText(body?.message || "");
    const mode = body?.mode === "playlist" ? "playlist" : "chat";

    if (!message) {
      sendJson(res, 400, { ok: false, code: "EMPTY_MESSAGE", message: "Mensagem vazia." });
      return;
    }

    const context = sanitizeContext(body?.context || {});

    if (mode === "playlist") {
      const raw = await callAi({
        messages: buildPlaylistMessages({ message, context }),
        json: true,
        maxTokens: 900,
        temperature: 0.8
      });
      const playlist = parsePlaylist(raw);

      if (!playlist) {
        sendJson(res, 502, { ok: false, code: "EMPTY_AI_REPLY", message: "A IA nao montou a playlist." });
        return;
      }

      sendJson(res, 200, { ok: true, playlist });
      return;
    }

    const history = sanitizeHistory(body?.history || body?.messages || []);
    const reply = stripReasoning(await callAi({ messages: buildMessages({ message, context, history }) }));

    if (!reply) {
      sendJson(res, 502, { ok: false, code: "EMPTY_AI_REPLY", message: "A IA nao retornou resposta." });
      return;
    }

    sendJson(res, 200, { ok: true, reply });
  } catch (error) {
    if (error?.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { ok: false, code: "BODY_TOO_LARGE", message: "Mensagem grande demais." });
      return;
    }

    if (error instanceof SyntaxError) {
      sendJson(res, 400, { ok: false, code: "INVALID_JSON", message: "JSON invalido." });
      return;
    }

    if (error?.name === "AbortError") {
      sendJson(res, 504, { ok: false, code: "AI_TIMEOUT", message: "MusicAI demorou demais para responder." });
      return;
    }

    if (!(error instanceof AiError)) {
      console.error("[MUSICAI_ERROR]", error);
    }

    const statusCode = [429, 503].includes(error?.statusCode) ? error.statusCode : 502;
    sendJson(res, statusCode, {
      ok: false,
      code: error?.code || "AI_UNAVAILABLE",
      message: "MusicAI nao conseguiu usar o backend de IA agora."
    });
  }
};

module.exports.parsePlaylist = parsePlaylist;
