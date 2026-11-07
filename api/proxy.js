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

const REQUEST_HEADERS_TO_FORWARD = new Set(["accept", "authorization", "content-type", "user-agent"]);
const RESPONSE_HEADERS_TO_SKIP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding"
]);
const ALLOWED_METHODS_BY_PATH = {
  "health": new Set(["GET", "HEAD"]),
  "auth/login": new Set(["POST"]),
  "auth/register": new Set(["POST"]),
  "auth/profile": new Set(["POST"]),
  "auth/password": new Set(["POST"]),
  "library": new Set(["GET", "PUT"]),
  "itunes/search": new Set(["GET", "HEAD"]),
  "itunes/lookup": new Set(["GET", "HEAD"])
};
const PUBLIC_PROFILE_PATH = /^users\/[a-z0-9_]{3,24}$/;
const MAX_PROXY_BODY_BYTES = 600 * 1024;

function allowedMethodsFor(path) {
  if (PUBLIC_PROFILE_PATH.test(path)) return new Set(["GET", "HEAD"]);
  return Object.hasOwn(ALLOWED_METHODS_BY_PATH, path) ? ALLOWED_METHODS_BY_PATH[path] : null;
}

function normalizeOrigin(origin) {
  const value = String(origin || "").trim();

  if (!value) return "";

  try {
    const url = new URL(value.replace(/\/api\/?$/i, ""));

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return `${url.protocol}//${url.host}`;
  } catch (error) {
    return "";
  }
}

function getApiOrigin() {
  return normalizeOrigin(process.env.WIKIBAND_API_ORIGIN || process.env.API_ORIGIN);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > MAX_PROXY_BODY_BYTES) {
        reject(new Error("PROXY_BODY_TOO_LARGE"));
        req.destroy();
        return;
      }

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
    const lowerKey = key.toLowerCase();

    if (
      HOP_BY_HOP_HEADERS.has(lowerKey) ||
      !REQUEST_HEADERS_TO_FORWARD.has(lowerKey) ||
      typeof value === "undefined"
    ) {
      return;
    }

    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  });

  // Vercel sets x-forwarded-for to the real client IP; the backend uses it for rate limiting.
  const proxySecret = String(process.env.PROXY_SHARED_SECRET || "").trim();
  const forwardedFor = req.headers?.["x-forwarded-for"];
  const clientIp = String(Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || "")
    .split(",")[0]
    .trim();

  if (proxySecret && clientIp) {
    headers.set("x-wikiband-proxy-secret", proxySecret);
    headers.set("x-wikiband-client-ip", clientIp);
  }

  return headers;
}

function buildTargetUrl(req, apiOrigin) {
  const requestUrl = new URL(String(req.url || "/"), "https://wikiband.local");
  const path = String(requestUrl.searchParams.get("path") || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const method = String(req.method || "GET").toUpperCase();

  if (!allowedMethodsFor(path)?.has(method)) {
    return null;
  }

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

    if (!targetUrl) {
      res.status(404).json({
        ok: false,
        code: "API_PROXY_PATH_NOT_ALLOWED",
        message: "Endpoint de API nao permitido pelo proxy."
      });
      return;
    }

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
    if (error?.message === "PROXY_BODY_TOO_LARGE") {
      res.status(413).json({
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        message: "Corpo da requisicao muito grande."
      });
      return;
    }

    console.error("Erro ao encaminhar requisicao da API:", error);
    res.status(502).json({
      ok: false,
      code: "API_PROXY_ERROR",
      message: "Nao foi possivel conectar ao backend do Wikiband."
    });
  }
};
