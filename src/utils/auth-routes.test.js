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
