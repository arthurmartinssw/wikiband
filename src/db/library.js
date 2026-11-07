const { query } = require("./index");

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS USUARIO_BIBLIOTECA (
      USUARIO_ID BIGINT PRIMARY KEY,
      DADOS JSONB NOT NULL DEFAULT '{}'::jsonb,
      PUBLICO BOOLEAN NOT NULL DEFAULT FALSE,
      ATUALIZADO_EM TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getLibrary(usuarioId) {
  const rows = await query(
    "SELECT DADOS, PUBLICO, ATUALIZADO_EM FROM USUARIO_BIBLIOTECA WHERE USUARIO_ID = $1",
    [usuarioId]
  );
  return rows[0] || null;
}

// dados / publico may be null to keep the stored value.
async function saveLibrary(usuarioId, dados, publico) {
  const rows = await query(
    `
      INSERT INTO USUARIO_BIBLIOTECA (USUARIO_ID, DADOS, PUBLICO)
      VALUES ($1, COALESCE($2::jsonb, '{}'::jsonb), COALESCE($3::boolean, FALSE))
      ON CONFLICT (USUARIO_ID) DO UPDATE SET
        DADOS = COALESCE($2::jsonb, USUARIO_BIBLIOTECA.DADOS),
        PUBLICO = COALESCE($3::boolean, USUARIO_BIBLIOTECA.PUBLICO),
        ATUALIZADO_EM = NOW()
      RETURNING DADOS, PUBLICO, ATUALIZADO_EM
    `,
    [usuarioId, dados === null ? null : JSON.stringify(dados), publico]
  );
  return rows[0];
}

module.exports = {
  getLibrary,
  migrate,
  saveLibrary
};
