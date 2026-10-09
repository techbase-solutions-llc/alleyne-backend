const { test } = require("node:test");
const assert = require("node:assert/strict");
const { limitConfirmationResend, RESEND_LIMIT } = require("./auth-routes");

const routes = () => [
  { method: "POST", path: "/auth/local", handler: "auth.callback", config: { middlewares: ["plugin::users-permissions.rateLimit"], prefix: "" } },
  { method: "POST", path: "/auth/send-email-confirmation", handler: "auth.sendEmailConfirmation", config: { prefix: "" } },
];

test("resending the confirmation email is limited to a few an hour per address (review, 8 Oct)", () => {
  const out = limitConfirmationResend(routes());
  const resend = out.find((r) => r.handler === "auth.sendEmailConfirmation");
  assert.deepEqual(resend.config.middlewares, [{ name: "plugin::users-permissions.rateLimit", config: RESEND_LIMIT }]);
  assert.deepEqual(RESEND_LIMIT, { interval: { min: 60 }, max: 3 });
  assert.equal(resend.config.prefix, "", "the rest of the route is kept");
  // Other routes are left alone.
  assert.deepEqual(out.find((r) => r.handler === "auth.callback").config.middlewares, ["plugin::users-permissions.rateLimit"]);
});

test("applied twice, the limit is added once", () => {
  const out = limitConfirmationResend(limitConfirmationResend(routes()));
  assert.equal(out.find((r) => r.handler === "auth.sendEmailConfirmation").config.middlewares.length, 1);
});

const { pinSignInLimitKey, signInLimitKey } = require("./auth-routes");
// Strapi's own limiter, by file: the package's exports do not list it.
const rateLimitFactory = require(require("node:path").join(__dirname, "../../node_modules/@strapi/plugin-users-permissions/server/middlewares/rateLimit.js"));

const withProvider = () => [
  ...routes(),
  { method: "GET", path: "/auth/:provider/callback", handler: "auth.callback", config: { prefix: "" } },
];

test("sign-in pins the limiter's key to the account being tried, ahead of the limiter (review, 8 Oct)", () => {
  const out = pinSignInLimitKey(withProvider());
  const local = out.find((r) => r.path === "/auth/local");
  assert.deepEqual(local.config.middlewares, [signInLimitKey, "plugin::users-permissions.rateLimit"]);
  assert.equal(local.config.prefix, "");
  // The provider callback (GET, no body) and other routes are left alone.
  assert.deepEqual(out.find((r) => r.method === "GET").config, { prefix: "" });
  assert.equal(out.find((r) => r.handler === "auth.sendEmailConfirmation").config.middlewares, undefined);
  // Applied twice, the key step is added once.
  assert.equal(pinSignInLimitKey(out).find((r) => r.path === "/auth/local").config.middlewares.length, 2);
});

test("the caller cannot choose the field the limiter counts by", async () => {
  const body = { identifier: " Owner@Example.com", password: "x", email: "random-1@x.test" };
  let called = false;
  await signInLimitKey({ request: { body } }, async () => { called = true; });
  assert.equal(body.email, "owner@example.com");
  assert.equal(called, true);
  const empty = {};
  await signInLimitKey({ request: { body: empty } }, async () => {});
  assert.equal(empty.email, "");
  // No body at all: passed on untouched (Strapi's validation answers it).
  await signInLimitKey({ request: {} }, async () => {});
});

// End to end with Strapi's own limiter (default 5 tries in 5 minutes per key).
const stubStrapi = { config: { get: () => undefined } };
const run = async (chain, body, ip) => {
  const ctx = { request: { body, path: "/auth/local", ip }, state: {}, set() {} };
  const step = (i) => (i < chain.length ? chain[i](ctx, () => step(i + 1)) : Promise.resolve());
  await step(0);
};
const guesses = async (chain, identifier, ip) => {
  let blocked = 0;
  for (let n = 0; n < 8; n++) {
    try {
      await run(chain, { identifier, password: `guess-${n}`, email: `rotate-${n}-${Math.random()}@x.test` }, ip);
    } catch (e) {
      if (e && e.name === "RateLimitError") blocked++;
      else throw e;
    }
  }
  return blocked;
};

test("rotating the email field no longer resets the sign-in limit", async () => {
  const limiter = rateLimitFactory({}, { strapi: stubStrapi });
  // Without the pinned key, every guess gets a fresh bucket: the bypass the review found.
  assert.equal(await guesses([limiter], "victim-a@example.com", "203.0.113.7"), 0);
  // With it, the sixth guess at the same account from the same address is refused.
  assert.equal(await guesses([signInLimitKey, limiter], "victim-b@example.com", "203.0.113.8"), 3);
  // Another account from the same address has its own allowance.
  await run([signInLimitKey, limiter], { identifier: "someone-else@example.com", password: "p" }, "203.0.113.8");
});
