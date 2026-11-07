// End-to-end tests of the auth, library and public profile routes against an in-memory Postgres.
process.env.DATABASE_URL ||= "postgresql://test@localhost/test";
process.env.SESSION_SECRET = "s".repeat(40);

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { newDb } = require("pg-mem");
const request = require("supertest");

const mem = newDb();
mem.public.none(`
  CREATE TABLE USUARIOS (
    ID SERIAL PRIMARY KEY,
    NOME TEXT NOT NULL,
    USERNAME TEXT UNIQUE NOT NULL,
    EMAIL TEXT UNIQUE NOT NULL,
    SENHA_HASH TEXT NOT NULL,
    CRIADO_EM TIMESTAMPTZ DEFAULT NOW()
  )
`);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();

// Swap the real database module for the in-memory one before the app loads it.
require.cache[path.resolve(__dirname, "../src/db/index.js")] = {
  exports: { query: async (sql, params) => (await pool.query(sql, params)).rows }
};

const app = require("../server");
const { migrate } = require("../src/db/library");

const agent = request(app);
const user = { nome: "Ana Teste", username: "ana_teste", email: "ana@gmail.com", senha: "SenhaForte1" };
let token = "";

test.before(async () => {
  await migrate();
});

test("cadastro e login devolvem um token", async () => {
  const register = await agent.post("/api/auth/register").send(user);
  assert.strictEqual(register.status, 201, JSON.stringify(register.body));

  const duplicate = await agent.post("/api/auth/register").send(user);
  assert.strictEqual(duplicate.status, 409);

  const wrong = await agent.post("/api/auth/login").send({ email: user.email, senha: "Errada123" });
  assert.strictEqual(wrong.status, 401);

  const login = await agent.post("/api/auth/login").send({ email: user.email, senha: user.senha });
  assert.strictEqual(login.status, 200);
  token = login.body.token;
  assert.ok(token);
});

test("senha acima de 72 bytes e recusada no cadastro", async () => {
  const res = await agent
    .post("/api/auth/register")
    .send({ ...user, username: "longa", email: "longa@gmail.com", senha: `A1${"é".repeat(40)}` });
  assert.strictEqual(res.status, 400);
});

test("biblioteca exige login e salva/le os dados", async () => {
  assert.strictEqual((await agent.get("/api/library")).status, 401);

  const empty = await agent.get("/api/library").set("Authorization", `Bearer ${token}`);
  assert.strictEqual(empty.status, 200);
  assert.deepStrictEqual(empty.body.dados, {});

  const dados = {
    albumFavorites: [{ tipo: "album", nome: "Banda", album: "Disco", albumId: 1, imagem: "javascript:alert(1)", segredo: "x" }],
    collections: [{ id: "c1", name: "Rock", items: [{ key: "album:1", item: { nome: "Banda", album: "Disco" } }] }]
  };
  const saved = await agent.put("/api/library").set("Authorization", `Bearer ${token}`).send({ dados });
  assert.strictEqual(saved.status, 200, JSON.stringify(saved.body));
  assert.strictEqual(saved.body.dados.albumFavorites.length, 1);
  assert.strictEqual(saved.body.publico, false);

  const bad = await agent.put("/api/library").set("Authorization", `Bearer ${token}`).send({ dados: { history: "x" } });
  assert.strictEqual(bad.status, 400);
});

test("perfil publico so aparece quando ativado e sem campos internos", async () => {
  assert.strictEqual((await agent.get("/api/users/ana_teste")).status, 404);
  assert.strictEqual((await agent.get("/api/users/nao_existe")).status, 404);

  await agent.put("/api/library").set("Authorization", `Bearer ${token}`).send({ publico: true }).expect(200);

  const res = await agent.get("/api/users/ana_teste");
  assert.strictEqual(res.status, 200);
  const album = res.body.profile.albumFavorites[0];
  assert.strictEqual(album.album, "Disco");
  assert.strictEqual(album.imagem, "");
  assert.strictEqual(album.segredo, undefined);
  assert.strictEqual(res.body.profile.email, undefined);
  assert.strictEqual(res.body.profile.collections[0].items[0].album, "Disco");
});

test("trocar a senha derruba os tokens antigos", async () => {
  const wrong = await agent
    .post("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ senhaAtual: "Errada123", novaSenha: "NovaSenha2" });
  assert.strictEqual(wrong.status, 401);

  const changed = await agent
    .post("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ senhaAtual: user.senha, novaSenha: "NovaSenha2" });
  assert.strictEqual(changed.status, 200);

  assert.strictEqual((await agent.get("/api/library").set("Authorization", `Bearer ${token}`)).status, 401);
  assert.strictEqual(
    (await agent.get("/api/library").set("Authorization", `Bearer ${changed.body.token}`)).status,
    200
  );
});

test("token adulterado e recusado", async () => {
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ email: user.email, iat: Date.now() })).toString("base64url");
  assert.notStrictEqual(forged, payload);
  assert.strictEqual(
    (await agent.get("/api/library").set("Authorization", `Bearer ${forged}.${signature}`)).status,
    401
  );
});
