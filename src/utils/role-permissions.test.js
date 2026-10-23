const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PUBLIC_PERMISSIONS, PUBLIC_REVOKED, toRevoke } = require("./role-permissions");

test("the public can no longer create property submissions or ask for confirmation emails (review, 8 Oct)", () => {
  assert.equal(PUBLIC_PERMISSIONS.includes("api::property-submission.property-submission.create"), false);
  assert.ok(PUBLIC_REVOKED.includes("api::property-submission.property-submission.create"));
  assert.ok(PUBLIC_REVOKED.includes("plugin::users-permissions.auth.sendEmailConfirmation"));
  // Nothing is granted and revoked at once.
  assert.deepEqual(PUBLIC_PERMISSIONS.filter((a) => PUBLIC_REVOKED.includes(a)), []);
});

test("every boot removes the revoked grants a role still holds, and nothing else", () => {
  const held = [
    { id: 1, action: "api::article.article.find" },
    { id: 2, action: "api::property-submission.property-submission.create" },
    { id: 3, action: "plugin::users-permissions.auth.sendEmailConfirmation" },
  ];
  assert.deepEqual(toRevoke(held, PUBLIC_REVOKED).map((p) => p.id), [2, 3]);
  assert.deepEqual(toRevoke([], PUBLIC_REVOKED), []);
  assert.deepEqual(toRevoke(undefined, PUBLIC_REVOKED), []);
});

test("no role reads or writes listing notes: the website's server token only (session 4, TEC-1909)", () => {
  const { LISTING_NOTE_ACTIONS } = require("./role-permissions");
  assert.deepEqual(LISTING_NOTE_ACTIONS, ["find", "findOne", "create", "update", "delete"].map((a) => `api::listing-note.listing-note.${a}`));
  for (const a of LISTING_NOTE_ACTIONS) {
    assert.ok(PUBLIC_REVOKED.includes(a), a);
    assert.equal(PUBLIC_PERMISSIONS.includes(a), false, a);
  }
});
