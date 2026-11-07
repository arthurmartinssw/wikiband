const { query } = require("./index");

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS SEGUIDORES (
      SEGUIDOR_ID BIGINT NOT NULL,
      SEGUIDO_ID BIGINT NOT NULL,
      CRIADO_EM TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (SEGUIDOR_ID, SEGUIDO_ID)
    )
  `);
  await query("CREATE INDEX IF NOT EXISTS SEGUIDORES_SEGUIDO_IDX ON SEGUIDORES (SEGUIDO_ID)");
}

async function follow(seguidorId, seguidoId) {
  await query(
    "INSERT INTO SEGUIDORES (SEGUIDOR_ID, SEGUIDO_ID) VALUES ($1, $2) ON CONFLICT (SEGUIDOR_ID, SEGUIDO_ID) DO NOTHING",
    [seguidorId, seguidoId]
  );
}

async function unfollow(seguidorId, seguidoId) {
  await query("DELETE FROM SEGUIDORES WHERE SEGUIDOR_ID = $1 AND SEGUIDO_ID = $2", [seguidorId, seguidoId]);
}

async function isFollowing(seguidorId, seguidoId) {
  const rows = await query("SELECT 1 AS SIM FROM SEGUIDORES WHERE SEGUIDOR_ID = $1 AND SEGUIDO_ID = $2", [
    seguidorId,
    seguidoId
  ]);
  return rows.length > 0;
}

async function counts(usuarioId) {
  const [seguidores] = await query("SELECT COUNT(*) AS TOTAL FROM SEGUIDORES WHERE SEGUIDO_ID = $1", [usuarioId]);
  const [seguindo] = await query("SELECT COUNT(*) AS TOTAL FROM SEGUIDORES WHERE SEGUIDOR_ID = $1", [usuarioId]);
  return { seguidores: Number(seguidores?.total) || 0, seguindo: Number(seguindo?.total) || 0 };
}

// Lists only people whose profile is public; private accounts still count in the totals.
async function listFollowers(usuarioId) {
  return query(
    `
      SELECT U.NOME, U.USERNAME
      FROM SEGUIDORES S
      JOIN USUARIOS U ON U.ID = S.SEGUIDOR_ID
      JOIN USUARIO_BIBLIOTECA B ON B.USUARIO_ID = U.ID AND B.PUBLICO = TRUE
      WHERE S.SEGUIDO_ID = $1
      ORDER BY S.CRIADO_EM DESC
      LIMIT 100
    `,
    [usuarioId]
  );
}

async function listFollowing(usuarioId) {
  return query(
    `
      SELECT U.NOME, U.USERNAME
      FROM SEGUIDORES S
      JOIN USUARIOS U ON U.ID = S.SEGUIDO_ID
      JOIN USUARIO_BIBLIOTECA B ON B.USUARIO_ID = U.ID AND B.PUBLICO = TRUE
      WHERE S.SEGUIDOR_ID = $1
      ORDER BY S.CRIADO_EM DESC
      LIMIT 100
    `,
    [usuarioId]
  );
}

function escapeLike(text) {
  return String(text).replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Public profiles matching a name/username; an empty term returns the most recently active ones.
async function searchPublicProfiles(term) {
  const pattern = `%${escapeLike(term)}%`;
  return query(
    `
      SELECT U.NOME, U.USERNAME
      FROM USUARIOS U
      JOIN USUARIO_BIBLIOTECA B ON B.USUARIO_ID = U.ID AND B.PUBLICO = TRUE
      WHERE U.USERNAME ILIKE $1 OR U.NOME ILIKE $1
      ORDER BY B.ATUALIZADO_EM DESC
      LIMIT 24
    `,
    [pattern]
  );
}

// shortcut: loads each followed user's full favorite lists and trims them in JS; fine for small
// libraries, move to a separate activity table if libraries or follow counts grow large.
async function feedFor(usuarioId) {
  return query(
    `
      SELECT U.NOME, U.USERNAME, B.DADOS, B.ATUALIZADO_EM
      FROM SEGUIDORES S
      JOIN USUARIOS U ON U.ID = S.SEGUIDO_ID
      JOIN USUARIO_BIBLIOTECA B ON B.USUARIO_ID = U.ID AND B.PUBLICO = TRUE
      WHERE S.SEGUIDOR_ID = $1
      ORDER BY B.ATUALIZADO_EM DESC
      LIMIT 30
    `,
    [usuarioId]
  );
}

module.exports = {
  counts,
  feedFor,
  follow,
  isFollowing,
  listFollowers,
  listFollowing,
  migrate,
  searchPublicProfiles,
  unfollow
};
