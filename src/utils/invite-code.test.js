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

const { codeStatus } = require("./invite-code");

test("the site can ask whether an invitation code is still the current one (review, 8 Oct)", () => {
  const code = newInviteCode();
  assert.deepEqual(codeStatus(code, code), { open: true, current: true });
  assert.deepEqual(codeStatus(code, newInviteCode()), { open: true, current: false }, "an earlier link after a resend");
  assert.deepEqual(codeStatus(null, code), { open: false, current: false }, "the link was used or withdrawn");
  assert.deepEqual(codeStatus(code, undefined), { open: true, current: null }, "no code asked about");
  assert.deepEqual(codeStatus(code, "short"), { open: true, current: false });
  assert.deepEqual(codeStatus(code, 12), { open: true, current: false });
});
