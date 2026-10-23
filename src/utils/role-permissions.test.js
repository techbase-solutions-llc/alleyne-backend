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

test("every role's listing-note grants are found, custom and future roles included (TEC-1909)", () => {
  const { listingNoteGrants } = require("./role-permissions");
  const roles = [
    { id: 1, type: "authenticated", name: "Authenticated", permissions: [
      { id: 11, action: "api::favorite.favorite.find" },
      { id: 12, action: "api::listing-note.listing-note.find" },
    ] },
    { id: 2, type: "public", name: "Public", permissions: [{ id: 21, action: "api::article.article.find" }] },
    { id: 3, type: "agent", name: "Agent", permissions: [
      { id: 31, action: "api::listing-note.listing-note.findOne" },
      { id: 32, action: "api::canonical-listing.canonical-listing.find" },
    ] },
    { id: 4, type: "moderator", name: "Moderator", permissions: [
      { id: 41, action: "api::listing-note.listing-note.update" },
      { id: 42, action: "api::listing-note.listing-note.delete" },
    ] },
    // A role added later, and an action added to the notes API later: both are caught.
    { id: 5, type: "valuer", name: "Valuer", permissions: [{ id: 51, action: "api::listing-note.listing-note.export" }] },
    // Look-alike actions on other content types stay.
    { id: 6, type: "host", name: "Host", permissions: [
      { id: 61, action: "api::listing-note-archive.listing-note-archive.find" },
      { id: 62, action: "api::listing.listing.find" },
      { id: 63, action: null },
    ] },
  ];
  assert.deepEqual(listingNoteGrants(roles).map((p) => p.id), [12, 31, 41, 42, 51]);
  assert.equal(listingNoteGrants(roles).find((p) => p.id === 31).role, "Agent");
});

test("finding listing-note grants is safe when there are none", () => {
  const { listingNoteGrants } = require("./role-permissions");
  assert.deepEqual(listingNoteGrants([]), []);
  assert.deepEqual(listingNoteGrants(undefined), []);
  assert.deepEqual(listingNoteGrants(null), []);
  assert.deepEqual(listingNoteGrants([{ id: 1, name: "Agent" }, { id: 2, name: "Host", permissions: [] }]), []);
});
