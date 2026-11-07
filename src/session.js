const crypto = require("crypto");
const config = require("./config");
const { findUserByEmail } = require("./db/users");

const SESSION_MAX_AGE_MS = config.security.sessionMaxAgeMs;

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// The signature covers the user's current password hash, so changing the password
// invalidates every token issued before it (logout from all devices).
function sign(payload, senhaHash) {
  return crypto
    .createHmac("sha256", config.security.sessionSecret)
    .update(`${payload}.${String(senhaHash || "")}`)
    .digest("base64url");
}

function createSessionToken(userRow) {
  const payload = toBase64Url(
    JSON.stringify({
      email: normalizeEmail(userRow?.email),
      iat: Date.now()
    })
  );

  return `${payload}.${sign(payload, userRow?.senha_hash)}`;
}

function readBearerToken(req) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function readTokenPayload(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const issuedAt = Number(data?.iat);

    if (!data?.email || !Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
      return null;
    }

    return { payload, signature, email: normalizeEmail(data.email) };
  } catch (error) {
    return null;
  }
}

function signatureMatches(signature, expected) {
  const a = Buffer.from(String(signature));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Returns the user row for a valid token, or null.
async function authenticateToken(token) {
  const parsed = readTokenPayload(token);
  if (!parsed) return null;

  const user = await findUserByEmail(parsed.email);
  if (!user) return null;

  return signatureMatches(parsed.signature, sign(parsed.payload, user.senha_hash)) ? user : null;
}

function requireUser(req, res, next) {
  authenticateToken(readBearerToken(req))
    .then((user) => {
      if (!user) {
        res.status(401).json({ ok: false, code: "UNAUTHORIZED", message: "Sessao expirada. Entre novamente." });
        return;
      }

      req.user = user;
      next();
    })
    .catch(next);
}

module.exports = {
  authenticateToken,
  createSessionToken,
  readBearerToken,
  requireUser
};
