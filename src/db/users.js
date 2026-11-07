const { query } = require("./index");

const USER_COLUMNS = "ID, NOME, USERNAME, EMAIL, SENHA_HASH, CRIADO_EM";

async function findUserByEmail(email) {
  const rows = await query(`SELECT ${USER_COLUMNS} FROM USUARIOS WHERE EMAIL = $1 LIMIT 1`, [email]);
  return rows[0] || null;
}

async function findUserByUsername(username) {
  const rows = await query(`SELECT ${USER_COLUMNS} FROM USUARIOS WHERE USERNAME = $1 LIMIT 1`, [username]);
  return rows[0] || null;
}

async function createUser(nome, username, email, senhaHash) {
  await query("INSERT INTO USUARIOS (NOME, USERNAME, EMAIL, SENHA_HASH) VALUES ($1, $2, $3, $4)", [
    nome,
    username,
    email,
    senhaHash
  ]);
}

async function updateUserProfile(email, nome, username) {
  await query("UPDATE USUARIOS SET NOME = $1, USERNAME = $2 WHERE EMAIL = $3", [nome, username, email]);
}

async function updateUserPassword(email, senhaHash) {
  await query("UPDATE USUARIOS SET SENHA_HASH = $1 WHERE EMAIL = $2", [senhaHash, email]);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByUsername,
  updateUserPassword,
  updateUserProfile
};
