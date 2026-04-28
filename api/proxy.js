const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const RESPONSE_HEADERS_TO_SKIP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding"
]);

function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

function getApiOrigin() {
  return normalizeOrigin(process.env.WIKIBAND_API_ORIGIN || process.env.API_ORIGIN);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

function copyRequestHeaders(req) {
  const headers = new Headers();

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || typeof value === "undefined") {
      return;
    }

    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  });

  return headers;
}

function buildTargetUrl(req, apiOrigin) {
  const requestUrl = new URL(String(req.url || "/"), "https://wikiband.local");
  const path = String(requestUrl.searchParams.get("path") || "").replace(/^\/+/, "");

  requestUrl.searchParams.delete("path");

  return new URL(`/api/${path}${requestUrl.search}`, apiOrigin);
}

module.exports = async function proxyApiRequest(req, res) {
  const apiOrigin = getApiOrigin();

  if (!apiOrigin) {
    res.status(502).json({
      ok: false,
      code: "API_ORIGIN_NOT_CONFIGURED",
      message: "Configure WIKIBAND_API_ORIGIN na Vercel com o hostname fixo do Cloudflare Tunnel."
    });
    return;
  }

  try {
    const targetUrl = buildTargetUrl(req, apiOrigin);
    const init = {
      method: req.method,
      headers: copyRequestHeaders(req),
      redirect: "manual"
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await readRequestBody(req);
    }

    const upstreamResponse = await fetch(targetUrl, init);

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      if (!RESPONSE_HEADERS_TO_SKIP.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const body = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(body);
  } catch (error) {
    console.error("Erro ao encaminhar requisicao da API:", error);
    res.status(502).json({
      ok: false,
      code: "API_PROXY_ERROR",
      message: "Nao foi possivel conectar ao backend do Wikiband."
    });
  }
};
