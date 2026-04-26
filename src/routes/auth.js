const express = require("express");
const bcrypt = require("bcrypt");
const { query } = require("../db/firebird");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_KEY_GDS_CODE = 335544665;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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
    email: String(userRow.email || "").toLowerCase(),
    criado_em: userRow.criado_em || null
  };
}

function isDuplicateEmailError(error) {
  return (
    Number(error?.gdscode) === DUPLICATE_KEY_GDS_CODE ||
    /unique|violation of primary or unique key|duplic/i.test(String(error?.message || ""))
  );
}

function isDatabaseConnectionError(error) {
  return (
    Number(error?.gdscode) === 335545106 ||
    /error occurred during login|connection rejected|connection shutdown|unable to complete network request/i.test(
      String(error?.message || "")
    )
  );
}

async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT FIRST 1
        ID,
        NOME,
        EMAIL,
        SENHA_HASH,
        CRIADO_EM
      FROM USUARIOS
      WHERE EMAIL = ?
    `,
    [email]
  );

  return rows[0] || null;
}

router.post("/register", async (req, res) => {
  const nome = sanitizeName(req.body?.nome);
  const email = normalizeEmail(req.body?.email);
  const senha = sanitizePassword(req.body?.senha);

  if (!nome || !email || !senha) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Preencha nome, e-mail e senha."
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

  if (senha.length < 6) {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Senha deve ter no minimo 6 caracteres."
    });
    return;
  }

  try {
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      res.status(409).json({
        ok: false,
        code: "EMAIL_EXISTS",
        message: "Este e-mail ja esta cadastrado."
      });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    await query(
      `
        INSERT INTO USUARIOS (NOME, EMAIL, SENHA_HASH)
        VALUES (?, ?, ?)
      `,
      [nome, email, senhaHash]
    );

    const createdUser = await findUserByEmail(email);

    res.status(201).json({
      ok: true,
      code: "REGISTERED",
      message: "Conta criada com sucesso.",
      user: mapUser(createdUser)
    });
  } catch (error) {
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

module.exports = router;
