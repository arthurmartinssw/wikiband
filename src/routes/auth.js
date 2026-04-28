const crypto = require("crypto");
const dns = require("dns").promises;
const express = require("express");
const bcrypt = require("bcrypt");
const config = require("../config");
const { query } = require("../db");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const DUPLICATE_KEY_GDS_CODE = 335544665;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const isPostgres = config.db.client === "postgres";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || "").trim();
}

function sanitizePassword(password) {
  return String(password || "");
}

function mapUser(userRow) {
  if (!userRow) return null;

  const parsedId = Number(userRow.id);

  return {
    id: Number.isFinite(parsedId) ? parsedId : null,
    nome: String(userRow.nome || ""),
    username: normalizeUsername(userRow.username),
    email: normalizeEmail(userRow.email),
    criado_em: userRow.criado_em || null
  };
}

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    process.env.DB_PASSWORD ||
    "wikiband-dev-session-secret"
  );
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signTokenPayload(payload) {
  return toBase64Url(
    crypto
      .createHmac("sha256", getSessionSecret())
      .update(payload)
      .digest()
  );
}

function createSessionToken(userRow) {
  const payload = toBase64Url(
    JSON.stringify({
      email: normalizeEmail(userRow?.email),
      username: normalizeUsername(userRow?.username),
      iat: Date.now()
    })
  );
  const signature = signTokenPayload(payload);
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  const [payload, signature] = String(token || "").split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signTokenPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(fromBase64Url(payload));
    const issuedAt = Number(data?.iat);

    if (!data?.email || !Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
      return null;
    }

    return {
      email: normalizeEmail(data.email),
      username: normalizeUsername(data.username),
      iat: issuedAt
    };
  } catch (error) {
    return null;
  }
}

function readBearerToken(req) {
  const authorization = String(req.get("authorization") || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function validatePassword(password) {
  if (password.length < 8) {
    return "Senha deve ter pelo menos 8 caracteres.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Senha deve ter pelo menos uma letra maiuscula.";
  }

  if (!/\d/.test(password)) {
    return "Senha deve ter pelo menos um numero.";
  }

  return "";
}

function validateUsername(username) {
  if (!USERNAME_REGEX.test(username)) {
    return "Nome de usuario deve ter 3 a 24 caracteres e usar apenas letras minusculas, numeros e underline.";
  }

  return "";
}

async function hasDeliverableEmailDomain(email) {
  const domain = String(email).split("@")[1];

  if (!domain) return false;

  try {
    const records = await dns.resolveMx(domain);
    if (records.some((record) => String(record.exchange || "").trim())) {
      return true;
    }
  } catch (error) {
    // Some valid domains accept mail without MX records, so fall back to address records below.
  }

  try {
    const addresses = await dns.resolve4(domain);
    if (addresses.length > 0) return true;
  } catch (error) {
    // Try IPv6 before rejecting.
  }

  try {
    const addresses = await dns.resolve6(domain);
    return addresses.length > 0;
  } catch (error) {
    return false;
  }
}

function isDuplicateEmailError(error) {
  return (
    error?.constraint === "usuarios_email_key" ||
    Number(error?.gdscode) === DUPLICATE_KEY_GDS_CODE ||
    /email|unique|violation of primary or unique key|duplic/i.test(String(error?.message || ""))
  );
}

function isDuplicateUsernameError(error) {
  return (
    error?.constraint === "usuarios_username_unique_idx" ||
    error?.constraint === "usuarios_username_key" ||
    /username|nome de usuario|unique|violation of primary or unique key|duplic/i.test(
      String(error?.message || "")
    )
  );
}

function isDatabaseConnectionError(error) {
  return (
    ["28P01", "3D000", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(String(error?.code || "")) ||
    Number(error?.gdscode) === 335545106 ||
    /error occurred during login|connection rejected|connection shutdown|unable to complete network request|password authentication failed|database .* does not exist|timeout/i.test(
      String(error?.message || "")
    )
  );
}

async function findUserByEmail(email) {
  const sql = isPostgres
    ? `
      SELECT
        ID,
        NOME,
        USERNAME,
        EMAIL,
        SENHA_HASH,
        CRIADO_EM
      FROM USUARIOS
      WHERE EMAIL = $1
      LIMIT 1
    `
    : `
      SELECT FIRST 1
        ID,
        NOME,
        USERNAME,
        EMAIL,
        SENHA_HASH,
        CRIADO_EM
      FROM USUARIOS
      WHERE EMAIL = ?
    `;

  const rows = await query(sql, [email]);
  return rows[0] || null;
}

async function findUserByUsername(username) {
  const sql = isPostgres
    ? `
      SELECT
        ID,
        NOME,
        USERNAME,
        EMAIL,
        SENHA_HASH,
        CRIADO_EM
      FROM USUARIOS
      WHERE USERNAME = $1
      LIMIT 1
    `
    : `
      SELECT FIRST 1
        ID,
        NOME,
        USERNAME,
        EMAIL,
        SENHA_HASH,
        CRIADO_EM
      FROM USUARIOS
      WHERE USERNAME = ?
    `;

  const rows = await query(sql, [username]);
  return rows[0] || null;
}

async function createUser(nome, username, email, senhaHash) {
  const sql = isPostgres
    ? `
      INSERT INTO USUARIOS (NOME, USERNAME, EMAIL, SENHA_HASH)
      VALUES ($1, $2, $3, $4)
    `
    : `
      INSERT INTO USUARIOS (NOME, USERNAME, EMAIL, SENHA_HASH)
      VALUES (?, ?, ?, ?)
    `;

  await query(sql, [nome, username, email, senhaHash]);
}

async function updateUserProfile(email, nome, username) {
  const sql = isPostgres
    ? `
      UPDATE USUARIOS
      SET NOME = $1,
          USERNAME = $2
      WHERE EMAIL = $3
    `
    : `
      UPDATE USUARIOS
      SET NOME = ?,
          USERNAME = ?
      WHERE EMAIL = ?
    `;

  await query(sql, [nome, username, email]);
}

router.post("/register", async (req, res) => {
  const nome = sanitizeName(req.body?.nome);
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const senha = sanitizePassword(req.body?.senha);

  if (!nome || !username || !email || !senha) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Preencha nome, nome de usuario, e-mail e senha."
    });
    return;
  }

  const usernameError = validateUsername(username);

  if (usernameError) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: usernameError
    });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe um e-mail valido."
    });
    return;
  }

  const passwordError = validatePassword(senha);

  if (passwordError) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: passwordError
    });
    return;
  }

  try {
    const emailDomainExists = await hasDeliverableEmailDomain(email);

    if (!emailDomainExists) {
      res.status(400).json({
        ok: false,
        code: "EMAIL_DOMAIN_INVALID",
        message: "Nao foi possivel confirmar esse dominio de e-mail."
      });
      return;
    }

    const existingEmail = await findUserByEmail(email);

    if (existingEmail) {
      res.status(409).json({
        ok: false,
        code: "EMAIL_EXISTS",
        message: "Este e-mail ja esta cadastrado."
      });
      return;
    }

    const existingUsername = await findUserByUsername(username);

    if (existingUsername) {
      res.status(409).json({
        ok: false,
        code: "USERNAME_EXISTS",
        message: "Este nome de usuario ja esta em uso."
      });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    await createUser(nome, username, email, senhaHash);

    const createdUser = await findUserByEmail(email);

    res.status(201).json({
      ok: true,
      code: "REGISTERED",
      message: "Conta criada com sucesso.",
      user: mapUser(createdUser)
    });
  } catch (error) {
    if (isDuplicateUsernameError(error)) {
      res.status(409).json({
        ok: false,
        code: "USERNAME_EXISTS",
        message: "Este nome de usuario ja esta em uso."
      });
      return;
    }

    if (isDuplicateEmailError(error)) {
      res.status(409).json({
        ok: false,
        code: "EMAIL_EXISTS",
        message: "Este e-mail ja esta cadastrado."
      });
      return;
    }

    if (isDatabaseConnectionError(error)) {
      res.status(503).json({
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel conectar ao banco de dados."
      });
      return;
    }

    console.error("[AUTH_REGISTER_ERROR]", error);
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Nao foi possivel criar a conta agora."
    });
  }
});

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const senha = sanitizePassword(req.body?.senha);

  if (!email || !senha) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe e-mail e senha."
    });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Informe um e-mail valido."
    });
    return;
  }

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      res.status(401).json({
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos."
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(senha, String(user.senha_hash || ""));

    if (!passwordMatches) {
      res.status(401).json({
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos."
      });
      return;
    }

    res.status(200).json({
      ok: true,
      code: "AUTHENTICATED",
      message: "Login realizado com sucesso.",
      token: createSessionToken(user),
      user: mapUser(user)
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      res.status(503).json({
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel conectar ao banco de dados."
      });
      return;
    }

    console.error("[AUTH_LOGIN_ERROR]", error);
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Nao foi possivel concluir o login agora."
    });
  }
});

router.post("/profile", async (req, res) => {
  const token = readBearerToken(req);
  const session = verifySessionToken(token);
  const nome = sanitizeName(req.body?.nome);
  const username = normalizeUsername(req.body?.username);

  if (!session) {
    res.status(401).json({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Sessao expirada. Entre novamente."
    });
    return;
  }

  if (!nome || !username) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Preencha nome e nome de usuario."
    });
    return;
  }

  const usernameError = validateUsername(username);

  if (usernameError) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: usernameError
    });
    return;
  }

  try {
    const currentUser = await findUserByEmail(session.email);

    if (!currentUser) {
      res.status(401).json({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Sessao expirada. Entre novamente."
      });
      return;
    }

    const existingUsername = await findUserByUsername(username);

    if (existingUsername && normalizeEmail(existingUsername.email) !== normalizeEmail(currentUser.email)) {
      res.status(409).json({
        ok: false,
        code: "USERNAME_EXISTS",
        message: "Este nome de usuario ja esta em uso."
      });
      return;
    }

    await updateUserProfile(normalizeEmail(currentUser.email), nome, username);

    const updatedUser = await findUserByEmail(normalizeEmail(currentUser.email));

    res.status(200).json({
      ok: true,
      code: "PROFILE_UPDATED",
      message: "Perfil atualizado com sucesso.",
      token: createSessionToken(updatedUser),
      user: mapUser(updatedUser)
    });
  } catch (error) {
    if (isDuplicateUsernameError(error)) {
      res.status(409).json({
        ok: false,
        code: "USERNAME_EXISTS",
        message: "Este nome de usuario ja esta em uso."
      });
      return;
    }

    if (isDatabaseConnectionError(error)) {
      res.status(503).json({
        ok: false,
        code: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel conectar ao banco de dados."
      });
      return;
    }

    console.error("[AUTH_PROFILE_ERROR]", error);
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Nao foi possivel atualizar o perfil agora."
    });
  }
});

module.exports = router;
