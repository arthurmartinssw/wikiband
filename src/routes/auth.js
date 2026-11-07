const dns = require("dns").promises;
const express = require("express");
const bcrypt = require("bcrypt");
const { clientIp, createRateLimiter } = require("../middleware/rate-limit");
const { createSessionToken, requireUser } = require("../session");
const users = require("../db/users");
const { isUniqueViolationOn } = require("../db/errors");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;
const BCRYPT_MAX_BYTES = 72;
const BCRYPT_ROUNDS = 12;
const DNS_TIMEOUT_MS = 2500;
const DUMMY_PASSWORD_HASH = "$2b$12$/nIg88jUTEMXHMr8jUt98ety0c94Tc25PXZmlb3gvpYqlUu/eL.kC";

const authIpLimiter = createRateLimiter({
  keyPrefix: "auth-ip",
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: "Muitas requisicoes de autenticacao. Aguarde alguns minutos e tente novamente."
});
const loginLimiter = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => `${clientIp(req)}:${normalizeEmail(req.body?.email) || "unknown"}`,
  message: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
});
const registerLimiter = createRateLimiter({
  keyPrefix: "auth-register",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente."
});
const profileLimiter = createRateLimiter({
  keyPrefix: "auth-profile",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Muitas atualizacoes de perfil. Aguarde alguns minutos e tente novamente."
});
const passwordLimiter = createRateLimiter({
  keyPrefix: "auth-password",
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Muitas tentativas de troca de senha. Aguarde alguns minutos e tente novamente."
});

router.use(authIpLimiter);

function fail(res, status, code, message) {
  res.status(status).json({ ok: false, code, message });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function sanitizeName(name) {
  return String(name || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function validateName(name) {
  return name.length > NAME_MAX_LENGTH ? `Nome deve ter no maximo ${NAME_MAX_LENGTH} caracteres.` : "";
}

function validateEmail(email) {
  return email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email) ? "Informe um e-mail valido." : "";
}

function validatePassword(password) {
  if (password.length < 8) return "Senha deve ter pelo menos 8 caracteres.";
  if (password.length > PASSWORD_MAX_LENGTH) return `Senha deve ter no maximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  // bcrypt ignores everything after 72 bytes.
  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) return "Senha longa demais. Use ate 72 caracteres simples.";
  if (!/[A-Z]/.test(password)) return "Senha deve ter pelo menos uma letra maiuscula.";
  if (!/\d/.test(password)) return "Senha deve ter pelo menos um numero.";
  return "";
}

function validateUsername(username) {
  return USERNAME_REGEX.test(username)
    ? ""
    : "Nome de usuario deve ter 3 a 24 caracteres e usar apenas letras minusculas, numeros e underline.";
}

function withTimeout(promise, timeoutMs) {
  let timeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("DNS_TIMEOUT")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function hasDeliverableEmailDomain(email) {
  const domain = String(email).split("@")[1];
  if (!domain) return false;

  // Some valid domains accept mail without MX records, so fall back to address records.
  for (const resolve of [dns.resolveMx, dns.resolve4, dns.resolve6]) {
    try {
      const records = await withTimeout(resolve(domain), DNS_TIMEOUT_MS);
      if (records.length > 0) return true;
    } catch (error) {
      // try the next record type
    }
  }

  return false;
}

router.post("/register", registerLimiter, async (req, res) => {
  const nome = sanitizeName(req.body?.nome);
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const senha = String(req.body?.senha || "");

  if (!nome || !username || !email || !senha) {
    fail(res, 400, "VALIDATION_ERROR", "Preencha nome, nome de usuario, e-mail e senha.");
    return;
  }

  const validationError =
    validateName(nome) || validateUsername(username) || validateEmail(email) || validatePassword(senha);

  if (validationError) {
    fail(res, 400, "VALIDATION_ERROR", validationError);
    return;
  }

  if (!(await hasDeliverableEmailDomain(email))) {
    fail(res, 400, "EMAIL_DOMAIN_INVALID", "Nao foi possivel confirmar esse dominio de e-mail.");
    return;
  }

  if (await users.findUserByEmail(email)) {
    fail(res, 409, "EMAIL_EXISTS", "Este e-mail ja esta cadastrado.");
    return;
  }

  if (await users.findUserByUsername(username)) {
    fail(res, 409, "USERNAME_EXISTS", "Este nome de usuario ja esta em uso.");
    return;
  }

  try {
    await users.createUser(nome, username, email, await bcrypt.hash(senha, BCRYPT_ROUNDS));
  } catch (error) {
    // Two sign-ups racing for the same e-mail/username.
    if (isUniqueViolationOn(error, "username")) {
      fail(res, 409, "USERNAME_EXISTS", "Este nome de usuario ja esta em uso.");
      return;
    }

    if (isUniqueViolationOn(error, "email")) {
      fail(res, 409, "EMAIL_EXISTS", "Este e-mail ja esta cadastrado.");
      return;
    }

    throw error;
  }

  res.status(201).json({
    ok: true,
    code: "REGISTERED",
    message: "Conta criada com sucesso.",
    user: mapUser(await users.findUserByEmail(email))
  });
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const senha = String(req.body?.senha || "");

  if (!email || !senha) {
    fail(res, 400, "VALIDATION_ERROR", "Informe e-mail e senha.");
    return;
  }

  const emailError = validateEmail(email);

  if (emailError) {
    fail(res, 400, "VALIDATION_ERROR", emailError);
    return;
  }

  if (senha.length > PASSWORD_MAX_LENGTH) {
    fail(res, 401, "INVALID_CREDENTIALS", "E-mail ou senha invalidos.");
    return;
  }

  const user = await users.findUserByEmail(email);
  // Compare against a dummy hash when the user is missing so response time does not reveal it.
  const passwordMatches = await bcrypt.compare(senha, user ? String(user.senha_hash || "") : DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    fail(res, 401, "INVALID_CREDENTIALS", "E-mail ou senha invalidos.");
    return;
  }

  res.status(200).json({
    ok: true,
    code: "AUTHENTICATED",
    message: "Login realizado com sucesso.",
    token: createSessionToken(user),
    user: mapUser(user)
  });
});

router.post("/profile", profileLimiter, requireUser, async (req, res) => {
  const nome = sanitizeName(req.body?.nome);
  const username = normalizeUsername(req.body?.username);
  const email = normalizeEmail(req.user.email);

  if (!nome || !username) {
    fail(res, 400, "VALIDATION_ERROR", "Preencha nome e nome de usuario.");
    return;
  }

  const validationError = validateName(nome) || validateUsername(username);

  if (validationError) {
    fail(res, 400, "VALIDATION_ERROR", validationError);
    return;
  }

  const existingUsername = await users.findUserByUsername(username);

  if (existingUsername && normalizeEmail(existingUsername.email) !== email) {
    fail(res, 409, "USERNAME_EXISTS", "Este nome de usuario ja esta em uso.");
    return;
  }

  try {
    await users.updateUserProfile(email, nome, username);
  } catch (error) {
    if (isUniqueViolationOn(error, "username")) {
      fail(res, 409, "USERNAME_EXISTS", "Este nome de usuario ja esta em uso.");
      return;
    }

    throw error;
  }

  const updatedUser = await users.findUserByEmail(email);

  res.status(200).json({
    ok: true,
    code: "PROFILE_UPDATED",
    message: "Perfil atualizado com sucesso.",
    token: createSessionToken(updatedUser),
    user: mapUser(updatedUser)
  });
});

router.post("/password", passwordLimiter, requireUser, async (req, res) => {
  const senhaAtual = String(req.body?.senhaAtual || "");
  const novaSenha = String(req.body?.novaSenha || "");

  if (!senhaAtual || !novaSenha) {
    fail(res, 400, "VALIDATION_ERROR", "Informe a senha atual e a nova senha.");
    return;
  }

  const passwordError = validatePassword(novaSenha);

  if (passwordError) {
    fail(res, 400, "VALIDATION_ERROR", passwordError);
    return;
  }

  if (senhaAtual.length > PASSWORD_MAX_LENGTH || !(await bcrypt.compare(senhaAtual, String(req.user.senha_hash || "")))) {
    fail(res, 401, "INVALID_CREDENTIALS", "Senha atual incorreta.");
    return;
  }

  const email = normalizeEmail(req.user.email);
  await users.updateUserPassword(email, await bcrypt.hash(novaSenha, BCRYPT_ROUNDS));
  const updatedUser = await users.findUserByEmail(email);

  res.status(200).json({
    ok: true,
    code: "PASSWORD_UPDATED",
    message: "Senha alterada. As outras sessoes foram encerradas.",
    token: createSessionToken(updatedUser),
    user: mapUser(updatedUser)
  });
});

module.exports = router;
