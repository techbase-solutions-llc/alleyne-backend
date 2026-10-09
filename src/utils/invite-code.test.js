// src/utils/invite-code.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { newInviteCode, tokenOnly } = require("./invite-code");

test("an invitation code is marked as one, then 128 hex characters, and never repeats", () => {
  const a = newInviteCode(), b = newInviteCode();
  assert.match(a, /^inv-[0-9a-f]{128}$/);
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
  assert.deepEqual(codeStatus(code, code), { open: true, current: true, invitation: true });
  assert.deepEqual(codeStatus(code, newInviteCode()), { open: true, current: false, invitation: true }, "an earlier link after a resend");
  assert.deepEqual(codeStatus(null, code), { open: false, current: false, invitation: false }, "the link was used or withdrawn");
  assert.deepEqual(codeStatus(code, undefined), { open: true, current: null, invitation: true }, "no code asked about");
  assert.deepEqual(codeStatus(code, "short"), { open: true, current: false, invitation: true });
  assert.deepEqual(codeStatus(code, 12), { open: true, current: false, invitation: true });
});

test("an open code from a forgotten-password request is not an invitation code (review, 8 Oct)", () => {
  // Strapi's forgot-password makes 128 hex characters with no mark: someone who set a
  // password, used the site and then asked for a reset has an open code, but not this one.
  const forgot = require("crypto").randomBytes(64).toString("hex");
  assert.deepEqual(codeStatus(forgot, undefined), { open: true, current: null, invitation: false });
  assert.deepEqual(codeStatus("", undefined), { open: false, current: false, invitation: false });
});

const { unusedInvitation } = require("./invite-code");

test("an invitation account counts as unused only with an invitation code open and nothing saved", () => {
  const open = codeStatus(newInviteCode());
  assert.equal(unusedInvitation(open, { favourites: 0, savedSearches: 0 }), true);
  assert.equal(unusedInvitation(open, { favourites: 1, savedSearches: 0 }), false);
  assert.equal(unusedInvitation(open, { favourites: 0, savedSearches: 2 }), false);
  assert.equal(unusedInvitation(codeStatus(require("crypto").randomBytes(64).toString("hex")), { favourites: 0, savedSearches: 0 }), false);
  assert.equal(unusedInvitation(codeStatus(null), { favourites: 0, savedSearches: 0 }), false);
  assert.equal(unusedInvitation(open, { favourites: NaN, savedSearches: 0 }), false, "a count that cannot be read keeps the account");
});
