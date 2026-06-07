const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3-32b";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_REPLY_CHARS = 1800;
const MAX_MESSAGE_CHARS = 1600;
const MAX_CONTEXT_CHARS = 7000;
const TIMEOUT_MS = 12000;
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
  return [
    "Voce e a MusicAI, assistente musical do Wikiband.",
    "Responda em portugues do Brasil, com tom natural, direto e util.",
    "Use o contexto da pagina, os resultados visiveis e o historico da conversa para entender o alvo da pergunta.",
    "Se a pessoa perguntar por integrantes, membros, formacao, vocalista, guitarrista, baixista ou baterista e houver artista no contexto, responda sobre esse artista. Nunca trate essas palavras como nome do artista.",
    "Nao diga que pesquisou em API, iTunes, Groq, Qwen, backend, dados fornecidos ou contexto, a menos que a pessoa pergunte sobre isso.",
    "Nao mostre raciocinio interno, tags de pensamento ou passos ocultos.",
    "Pode usar conhecimento musical geral, mas nao invente fatos especificos: quando nao tiver certeza, diga isso de forma simples.",
    "Prefira respostas com 2 a 5 frases curtas. Use lista curta somente quando ajudar, como albuns ou faixas para comecar."
  ].join(" ");
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

async function callGroq({ apiKey, model, messages }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.65,
        max_tokens: 560,
        top_p: 0.9
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data?.error?.message || "GROQ_UNAVAILABLE");
      error.statusCode = response.status;
      error.code = response.status === 429 ? "RATE_LIMITED" : "GROQ_UNAVAILABLE";
      throw error;
    }

    return stripReasoning(data?.choices?.[0]?.message?.content || "");
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
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

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    sendJson(res, 503, {
      ok: false,
      code: "MISSING_API_KEY",
      message: "MusicAI ainda nao esta conectada ao backend de IA."
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const message = cleanMultilineText(body?.message || "");

    if (!message) {
      sendJson(res, 400, { ok: false, code: "EMPTY_MESSAGE", message: "Mensagem vazia." });
      return;
    }

    const context = sanitizeContext(body?.context || {});
    const history = sanitizeHistory(body?.history || body?.messages || []);
    const model = compactText(process.env.MUSICAI_MODEL || DEFAULT_MODEL) || DEFAULT_MODEL;
    const reply = await callGroq({
      apiKey,
      model,
      messages: buildMessages({ message, context, history })
    });

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

    const statusCode = error?.statusCode === 429 ? 429 : 502;
    sendJson(res, statusCode, {
      ok: false,
      code: error?.code || "AI_UNAVAILABLE",
      message: "MusicAI nao conseguiu usar o backend de IA agora."
    });
  }
};
