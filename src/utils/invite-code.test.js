// src/utils/invite-code.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { newInviteCode, tokenOnly } = require("./invite-code");

test("an invitation code is 128 hex characters and never repeats", () => {
  const a = newInviteCode(), b = newInviteCode();
  assert.match(a, /^[0-9a-f]{128}$/);
  assert.notEqual(a, b);
});

test("only the site's API token may ask for a code, never a signed-in user", () => {
  assert.equal(tokenOnly({ state: { auth: { strategy: { name: "api-token" } } } }), true);
  assert.equal(tokenOnly({ state: { user: { id: 3 }, auth: { strategy: { name: "users-permissions" } } } }), false);
  assert.equal(tokenOnly({ state: {} }), false);
});
