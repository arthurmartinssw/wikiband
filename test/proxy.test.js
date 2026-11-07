// The Vercel proxy only forwards allowlisted paths/methods and passes the client IP with the shared secret.
const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { Readable } = require("stream");

process.env.PROXY_SHARED_SECRET = "segredo-proxy";

let lastUpstream = null;
const upstream = http.createServer((req, res) => {
  lastUpstream = { url: req.url, method: req.method, headers: req.headers };
  res.setHeader("Content-Type", "application/json");
  res.end('{"ok":true}');
});

const proxy = require("../api/proxy");

function call({ url, method = "GET", headers = {}, body = "" }) {
  const req = Object.assign(Readable.from(body ? [Buffer.from(body)] : []), { url, method, headers });
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      setHeader(key, value) { this.headers[key] = value; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
      end(buffer) { resolve({ status: this.statusCode, body: JSON.parse(String(buffer)) }); }
    };
    proxy(req, res);
  });
}

test.before(() => new Promise((resolve) => upstream.listen(0, resolve)));
test.after(() => upstream.close());

test("encaminha rotas permitidas com o IP real e o segredo", async () => {
  process.env.WIKIBAND_API_ORIGIN = `http://127.0.0.1:${upstream.address().port}`;

  const res = await call({ url: "/api/proxy?path=users/ana_teste", headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(lastUpstream.url, "/api/users/ana_teste");
  assert.strictEqual(lastUpstream.headers["x-wikiband-client-ip"], "203.0.113.9");
  assert.strictEqual(lastUpstream.headers["x-wikiband-proxy-secret"], "segredo-proxy");

  const put = await call({ url: "/api/proxy?path=library", method: "PUT", headers: { "content-type": "application/json" }, body: "{}" });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(lastUpstream.method, "PUT");
});

test("recusa rotas, metodos e usuarios fora da lista", async () => {
  process.env.WIKIBAND_API_ORIGIN = `http://127.0.0.1:${upstream.address().port}`;

  for (const [url, method] of [
    ["/api/proxy?path=users/../auth/login", "GET"],
    ["/api/proxy?path=users/ab", "GET"],
    ["/api/proxy?path=users/Ana_Maiuscula", "GET"],
    ["/api/proxy?path=library", "DELETE"],
    ["/api/proxy?path=auth/login", "GET"],
    ["/api/proxy?path=admin", "GET"]
  ]) {
    assert.strictEqual((await call({ url, method })).status, 404, `${method} ${url}`);
  }
});

test("cliente nao consegue injetar o cabecalho de IP", async () => {
  process.env.WIKIBAND_API_ORIGIN = `http://127.0.0.1:${upstream.address().port}`;

  await call({
    url: "/api/proxy?path=health",
    headers: { "x-forwarded-for": "198.51.100.1", "x-wikiband-client-ip": "1.2.3.4", "x-wikiband-proxy-secret": "chute" }
  });
  assert.strictEqual(lastUpstream.headers["x-wikiband-client-ip"], "198.51.100.1");
  assert.strictEqual(lastUpstream.headers["x-wikiband-proxy-secret"], "segredo-proxy");
});
