// The client-action history (client accounts plan, 5 Nov 2026, section 4) is written and read only
// by the website's full-access server token. No role holds the routes, and every one of the five
// core routes also carries the consent endpoint's server-token-only policy, so a read-only or
// custom API token is refused with 403 as well (review, 5 Nov 2026).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { serverTokenOnly } = require("./client-consent");

const schema = require(path.join(__dirname, "..", "api", "client-action", "content-types", "client-action", "schema.json"));

function routes() {
  const before = global.strapi;
  global.strapi = { contentType: (uid) => ({ ...schema, uid, modelName: "client-action" }) };
  try {
    const file = path.join(__dirname, "..", "api", "client-action", "routes", "client-action.js");
    delete require.cache[file];
    return require(file).routes;
  } finally {
    global.strapi = before;
  }
}

const token = (type) => ({ state: { auth: { strategy: { name: "api-token" }, credentials: { type } } } });

test("all five client-action routes carry the server-token-only policy", () => {
  const r = routes();
  assert.deepEqual(r.map((x) => x.handler.split(".").pop()).sort(), ["create", "delete", "find", "findOne", "update"]);
  for (const x of r) assert.deepEqual(x.config.policies, ["api::client-consent.server-token-only"], `${x.method} ${x.path}`);
});

test("the policy on those routes passes the full-access token only; read-only and custom tokens get 403", () => {
  const policy = require("../api/client-consent/policies/server-token-only");
  assert.equal(policy(token("full-access")), true);
  for (const ctx of [
    token("read-only"),
    token("custom"),
    { state: {} },
    { state: { user: { id: 3, role: { type: "agencyowner" } }, auth: { strategy: { name: "users-permissions" } } } },
  ]) {
    assert.equal(policy(ctx), false);
    assert.equal(policy(ctx), serverTokenOnly(ctx));
  }
});
