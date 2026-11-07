process.env.DATABASE_URL ||= "postgresql://test@localhost/test";
process.env.PROXY_SHARED_SECRET = "segredo-de-teste";

const test = require("node:test");
const assert = require("node:assert");
const { clientIp } = require("../src/middleware/rate-limit");

function fakeReq(headers, ip = "10.0.0.1") {
  return { ip, get: (name) => headers[name.toLowerCase()] };
}

test("usa o IP repassado pelo proxy quando o segredo confere", () => {
  const req = fakeReq({ "x-wikiband-proxy-secret": "segredo-de-teste", "x-wikiband-client-ip": "203.0.113.7" });
  assert.strictEqual(clientIp(req), "203.0.113.7");
});

test("ignora o IP repassado quando o segredo esta errado ou ausente", () => {
  assert.strictEqual(clientIp(fakeReq({ "x-wikiband-proxy-secret": "errado", "x-wikiband-client-ip": "203.0.113.7" })), "10.0.0.1");
  assert.strictEqual(clientIp(fakeReq({ "x-wikiband-client-ip": "203.0.113.7" })), "10.0.0.1");
});
