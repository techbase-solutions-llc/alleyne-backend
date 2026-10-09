const { test } = require("node:test");
const assert = require("node:assert/strict");
const Koa = require("koa");
const { trustLastProxyHop } = require("./client-ip");

// A request as Koa sees it behind Render: X-Forwarded-For as the caller sent it, plus the
// address Render's proxy appended.
const ipOf = (app, xff) => app.createContext({ headers: xff ? { "x-forwarded-for": xff } : {}, socket: { remoteAddress: "10.0.0.9" } }, {}).request.ip;

test("the client address is the hop Render's proxy added, not one the caller wrote (review, 8 Oct)", () => {
  const app = trustLastProxyHop(new Koa({ proxy: true }), {});
  assert.equal(ipOf(app, "1.2.3.4, 203.0.113.7"), "203.0.113.7");
  assert.equal(ipOf(app, "9.9.9.9, 8.8.8.8, 203.0.113.7"), "203.0.113.7");
  assert.equal(ipOf(app, "203.0.113.7"), "203.0.113.7");
  assert.equal(ipOf(app, ""), "10.0.0.9");
});

test("without the fix the caller chooses the address (what the review reproduced)", () => {
  const app = new Koa({ proxy: true });
  assert.equal(ipOf(app, "1.2.3.4, 203.0.113.7"), "1.2.3.4");
});

test("the number of trusted hops and the header can be set without a code change", () => {
  const two = trustLastProxyHop(new Koa({ proxy: true }), { PROXY_TRUSTED_HOPS: "2" });
  assert.equal(two.maxIpsCount, 2);
  assert.equal(ipOf(two, "1.2.3.4, 198.51.100.1, 203.0.113.7"), "198.51.100.1");
  const cf = trustLastProxyHop(new Koa({ proxy: true }), { PROXY_IP_HEADER: "CF-Connecting-IP" });
  assert.equal(cf.proxyIpHeader, "CF-Connecting-IP");
  // Nonsense falls back to one hop.
  assert.equal(trustLastProxyHop(new Koa({ proxy: true }), { PROXY_TRUSTED_HOPS: "x" }).maxIpsCount, 1);
  assert.equal(trustLastProxyHop(new Koa({ proxy: true }), { PROXY_TRUSTED_HOPS: "0" }).maxIpsCount, 1);
});
