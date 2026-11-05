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

// Listing transactions (Orna, 23 Oct 2026; TEC-1909): prices, purchasers and commission are
// office only, held by no role, exactly as the notes are.
test("no role reads or writes listing transactions: the website's server token only", () => {
  const { LISTING_TRANSACTION_ACTIONS } = require("./role-permissions");
  assert.deepEqual(LISTING_TRANSACTION_ACTIONS, ["find", "findOne", "create", "update", "delete"].map((a) => `api::listing-transaction.listing-transaction.${a}`));
  for (const a of LISTING_TRANSACTION_ACTIONS) {
    assert.ok(PUBLIC_REVOKED.includes(a), a);
    assert.equal(PUBLIC_PERMISSIONS.includes(a), false, a);
  }
});

test("every role's notes and transactions grants are found, and nothing else", () => {
  const { officeOnlyGrants } = require("./role-permissions");
  const roles = [
    { id: 1, name: "Authenticated", permissions: [
      { id: 11, action: "api::favorite.favorite.find" },
      { id: 12, action: "api::listing-transaction.listing-transaction.find" },
      { id: 13, action: "api::listing-note.listing-note.find" },
    ] },
    { id: 3, name: "Agent", permissions: [
      { id: 31, action: "api::listing-transaction.listing-transaction.update" },
      { id: 32, action: "api::canonical-listing.canonical-listing.find" },
    ] },
    // An action added later is caught; a look-alike content type is not.
    { id: 5, name: "Valuer", permissions: [
      { id: 51, action: "api::listing-transaction.listing-transaction.export" },
      { id: 52, action: "api::listing-transaction-archive.listing-transaction-archive.find" },
      { id: 53, action: undefined },
    ] },
  ];
  assert.deepEqual(officeOnlyGrants(roles).map((p) => p.id), [12, 13, 31, 51]);
  assert.equal(officeOnlyGrants(roles).find((p) => p.id === 31).role, "Agent");
  assert.deepEqual(officeOnlyGrants(undefined), []);
  assert.deepEqual(officeOnlyGrants([{ id: 1, name: "Host" }]), []);
});

test("every role's grant on the daily visitor counts is found too (TEC-1344)", () => {
  const { officeOnlyGrants, PAGE_VIEW_DAY_PREFIX } = require("./role-permissions");
  assert.equal(PAGE_VIEW_DAY_PREFIX, "api::page-view-day.page-view-day.");
  const roles = [
    { id: 1, name: "Public", permissions: [{ id: 11, action: "api::page-view-day.page-view-day.find" }] },
    { id: 2, name: "Authenticated", permissions: [
      { id: 21, action: "api::page-view-day.page-view-day.add" },
      { id: 22, action: "api::favorite.favorite.find" },
    ] },
    { id: 3, name: "Agent", permissions: [
      { id: 31, action: "api::page-view-day-archive.page-view-day-archive.find" },
      { id: 32, action: "api::page-view-seen.page-view-seen.find" },
      { id: 33, action: "api::page-view-batch.page-view-batch.find" },
    ] },
  ];
  assert.deepEqual(officeOnlyGrants(roles).map((p) => p.id), [11, 21, 32, 33]);
});

// Website feedback (site feedback plan, 3 Nov 2026): visitors' reports and staff notes on them.
// No role creates, reads, changes or deletes them; the website writes and reads them with its
// server token after its own checks, exactly as the notes.
test("no role creates, reads, changes or deletes site feedback: the website's server token only", () => {
  const { SITE_FEEDBACK_ACTIONS, SITE_FEEDBACK_PREFIX } = require("./role-permissions");
  assert.equal(SITE_FEEDBACK_PREFIX, "api::site-feedback.site-feedback.");
  assert.deepEqual(SITE_FEEDBACK_ACTIONS, ["find", "findOne", "create", "update", "delete"].map((a) => `api::site-feedback.site-feedback.${a}`));
  for (const a of SITE_FEEDBACK_ACTIONS) {
    assert.ok(PUBLIC_REVOKED.includes(a), a);
    assert.equal(PUBLIC_PERMISSIONS.includes(a), false, a);
  }
  assert.equal(PUBLIC_PERMISSIONS.some((a) => a.startsWith(SITE_FEEDBACK_PREFIX)), false);
});

test("every role's site-feedback grant is found on boot, custom and future roles and actions included", () => {
  const { officeOnlyGrants } = require("./role-permissions");
  const roles = [
    { id: 1, name: "Public", permissions: [
      { id: 11, action: "api::site-feedback.site-feedback.create" },
      { id: 12, action: "api::article.article.find" },
    ] },
    { id: 2, name: "Authenticated", permissions: [
      { id: 21, action: "api::site-feedback.site-feedback.find" },
      { id: 22, action: "api::site-feedback.site-feedback.findOne" },
    ] },
    { id: 3, name: "Agent", permissions: [
      { id: 31, action: "api::site-feedback.site-feedback.update" },
      { id: 32, action: "api::site-feedback.site-feedback.delete" },
    ] },
    // An action added later is caught; a look-alike content type is not.
    { id: 4, name: "Moderator", permissions: [
      { id: 41, action: "api::site-feedback.site-feedback.export" },
      { id: 42, action: "api::site-feedback-archive.site-feedback-archive.find" },
    ] },
  ];
  assert.deepEqual(officeOnlyGrants(roles).map((p) => p.id), [11, 21, 22, 31, 32, 41]);
  assert.equal(officeOnlyGrants(roles).find((p) => p.id === 11).role, "Public");
});

test("the Authenticated role's revoke list on boot covers site feedback, and nothing grants it", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.js"), "utf8");
  assert.ok(src.includes("...SITE_FEEDBACK_ACTIONS"), "src/index.js must revoke SITE_FEEDBACK_ACTIONS from Authenticated");
  // No literal grant of any site-feedback action anywhere in the boot code.
  assert.equal(/['"]api::site-feedback\.site-feedback\.[A-Za-z]+['"]/.test(src), false, "src/index.js names a site-feedback action");
});

// Client accounts (client accounts plan, 5 Nov 2026, sections 4 and 5): the office's record of
// what staff did to each account, and the endpoint that reads one account's consent fields.
// No role holds either; the website reaches them with its server token only.
test("no role reads or writes client actions or reads client consent: the website's server token only", () => {
  const { CLIENT_ACTION_ACTIONS, CLIENT_ACTION_PREFIX, CLIENT_CONSENT_ACTIONS, CLIENT_CONSENT_PREFIX } = require("./role-permissions");
  assert.equal(CLIENT_ACTION_PREFIX, "api::client-action.client-action.");
  assert.deepEqual(CLIENT_ACTION_ACTIONS, ["find", "findOne", "create", "update", "delete"].map((a) => `api::client-action.client-action.${a}`));
  assert.equal(CLIENT_CONSENT_PREFIX, "api::client-consent.client-consent.");
  assert.deepEqual(CLIENT_CONSENT_ACTIONS, ["api::client-consent.client-consent.findOne"]);
  for (const a of [...CLIENT_ACTION_ACTIONS, ...CLIENT_CONSENT_ACTIONS]) {
    assert.ok(PUBLIC_REVOKED.includes(a), a);
    assert.equal(PUBLIC_PERMISSIONS.includes(a), false, a);
  }
  assert.equal(PUBLIC_PERMISSIONS.some((a) => a.startsWith(CLIENT_ACTION_PREFIX) || a.startsWith(CLIENT_CONSENT_PREFIX)), false);
});

test("every role's client-action and client-consent grant is found on boot, custom and future roles and actions included", () => {
  const { officeOnlyGrants } = require("./role-permissions");
  const roles = [
    { id: 1, name: "Public", permissions: [
      { id: 11, action: "api::client-consent.client-consent.findOne" },
      { id: 12, action: "api::article.article.find" },
    ] },
    { id: 2, name: "Authenticated", permissions: [
      { id: 21, action: "api::client-action.client-action.find" },
      { id: 22, action: "api::client-action.client-action.create" },
    ] },
    { id: 3, name: "AgencyOwner", permissions: [
      { id: 31, action: "api::client-action.client-action.delete" },
      { id: 32, action: "api::client-consent.client-consent.findOne" },
    ] },
    // An action added later is caught; a look-alike content type is not.
    { id: 4, name: "Moderator", permissions: [
      { id: 41, action: "api::client-consent.client-consent.find" },
      { id: 42, action: "api::client-action-archive.client-action-archive.find" },
    ] },
  ];
  assert.deepEqual(officeOnlyGrants(roles).map((p) => p.id), [11, 21, 22, 31, 32, 41]);
});

test("the Authenticated role's revoke list on boot covers client actions and consent, and nothing grants them", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.js"), "utf8");
  assert.ok(src.includes("...CLIENT_ACTION_ACTIONS"), "src/index.js must revoke CLIENT_ACTION_ACTIONS from Authenticated");
  assert.ok(src.includes("...CLIENT_CONSENT_ACTIONS"), "src/index.js must revoke CLIENT_CONSENT_ACTIONS from Authenticated");
  assert.equal(/['"]api::client-(action|consent)\.client-(action|consent)\.[A-Za-z]+['"]/.test(src), false, "src/index.js names a client-action or client-consent action");
});
