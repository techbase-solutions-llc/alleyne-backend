// Fields the website writes that must exist on the content types (audit, 12 Oct 2026).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const schema = (api) => require(path.join(__dirname, "..", "api", api, "content-types", api, "schema.json"));

test("a property submission keeps its ActiveCampaign contact id, as a lead does", () => {
  const lead = schema("lead").attributes.activecampaignContactId;
  assert.deepEqual(lead, { type: "string" });
  assert.deepEqual(schema("property-submission").attributes.activecampaignContactId, lead);
});

// Listing notes (session 4, 21 Oct 2026; TEC-1909): the office's dated log on each listing.
// The website writes listing, noteType, body, author and authorName with its server token.
test("a listing note has its listing, type, text and author", () => {
  const a = schema("listing-note").attributes;
  assert.deepEqual(a.listing, { type: "relation", relation: "manyToOne", target: "api::canonical-listing.canonical-listing", required: true });
  assert.deepEqual(a.noteType.enum, ["price_change", "owner_discussion", "access", "viewing", "other"]);
  assert.equal(a.noteType.type, "enumeration");
  assert.equal(a.noteType.required, true);
  assert.equal(a.body.type, "text");
  assert.equal(a.body.required, true);
  // The website's limit (MAX_NOTE in src/lib/listing-notes.ts) matches.
  assert.equal(a.body.maxLength, 4000);
  assert.deepEqual(a.author, { type: "relation", relation: "manyToOne", target: "plugin::users-permissions.user" });
  assert.equal(a.authorName.type, "string");
  assert.equal(schema("listing-note").options.draftAndPublish, false);
});

test("a listing carries no link back to its notes, so reading a listing never brings them", () => {
  // populate=* on a public listing read must not reach the office's notes.
  const listing = schema("canonical-listing").attributes;
  for (const [name, attr] of Object.entries(listing))
    assert.notEqual(attr.target, "api::listing-note.listing-note", `canonical-listing.${name} points at listing notes`);
});

// The sign-up form's marketing box (session 4, TEC-1909; Barbados Data Protection Act 2019).
test("an account records marketing consent, off unless given, with the moment it was given", () => {
  const user = require(path.join(__dirname, "..", "extensions", "users-permissions", "content-types", "user", "schema.json")).attributes;
  assert.deepEqual(user.marketingOptIn, { type: "boolean", default: false });
  assert.deepEqual(user.marketingOptInAt, { type: "datetime", private: true });
});

// The consent record (consent audit, 26 Oct 2026; TEC-1909): what the person agreed to, in
// which wording, where, and when they withdrew it. Withdrawal no longer wipes the date given.
// Private: never in an API answer (not even /users/me); the website's server token writes them
// and the office reads them in the admin panel. Additive and optional.
test("an account keeps the wording, version and place of its marketing consent, and when it was withdrawn", () => {
  const user = require(path.join(__dirname, "..", "extensions", "users-permissions", "content-types", "user", "schema.json")).attributes;
  assert.deepEqual(user.marketingConsentText, { type: "text", private: true });
  assert.deepEqual(user.marketingConsentVersion, { type: "string", private: true });
  assert.deepEqual(user.marketingConsentSource, { type: "enumeration", enum: ["signup", "profile"], private: true });
  assert.deepEqual(user.marketingOptOutAt, { type: "datetime", private: true });
  assert.deepEqual(user.marketingOptOutSource, { type: "enumeration", enum: ["profile", "unsubscribe"], private: true });
  // The date given is private too (end-to-end run, 26 Oct): no API answer needs it.
  assert.deepEqual(user.marketingOptIn, { type: "boolean", default: false });
  assert.deepEqual(user.marketingOptInAt, { type: "datetime", private: true });
});

// Sales back office fields (Orna, 23 Oct 2026; TEC-1909). All optional and additive.
test("a listing keeps its owner, agents, sign, keys and Hostfully discounts for the office", () => {
  const a = schema("canonical-listing").attributes;
  assert.deepEqual(a.ownerName, { type: "string" });
  assert.deepEqual(a.ownerPhone, { type: "string" });
  assert.deepEqual(a.ownerEmail, { type: "string" });
  assert.deepEqual(a.listingAgents, { type: "json" });
  assert.deepEqual(a.coBrokeAgent, { type: "string" });
  assert.deepEqual(a.signInstalled, { type: "boolean" });
  assert.deepEqual(a.signInstalledOn, { type: "date" });
  assert.deepEqual(a.keysProvided, { type: "boolean" });
  assert.deepEqual(a.hostfullyDiscounts, { type: "json" });
  for (const name of ["ownerName", "ownerPhone", "ownerEmail", "listingAgents", "coBrokeAgent", "signInstalled", "signInstalledOn", "keysProvided", "hostfullyDiscounts"])
    assert.notEqual(a[name].required, true, `${name} must stay optional`);
});

test("a listing note can be about access or a viewing, and the older types stay", () => {
  const n = schema("listing-note").attributes.noteType;
  assert.deepEqual(n.enum, ["price_change", "owner_discussion", "access", "viewing", "other"]);
  assert.equal(n.default, "other");
});

test("a listing transaction records the deal on one listing, with no commission amount", () => {
  const t = schema("listing-transaction");
  assert.equal(t.collectionName, "listing_transactions");
  assert.equal(t.info.singularName, "listing-transaction");
  assert.equal(t.info.pluralName, "listing-transactions");
  assert.equal(t.options.draftAndPublish, false);
  const a = t.attributes;
  assert.deepEqual(a.listing, { type: "relation", relation: "manyToOne", target: "api::canonical-listing.canonical-listing", required: true });
  assert.deepEqual(a.dateAgreed, { type: "date" });
  assert.deepEqual(a.purchaserName, { type: "string" });
  assert.deepEqual(a.purchaserAgent, { type: "string" });
  assert.deepEqual(a.priceMinor, { type: "biginteger" });
  assert.deepEqual(a.currency, { type: "enumeration", enum: ["BBD", "USD", "EUR", "GBP"] });
  assert.deepEqual(a.purchaserAttorney, { type: "string" });
  assert.deepEqual(a.vendorAttorney, { type: "string" });
  assert.deepEqual(a.closeDate, { type: "date" });
  assert.deepEqual(a.coBrokeAgent, { type: "string" });
  assert.deepEqual(a.commissionPercent, { type: "decimal" });
  assert.deepEqual(a.author, { type: "relation", relation: "manyToOne", target: "plugin::users-permissions.user" });
  assert.deepEqual(a.authorName, { type: "string" });
  assert.deepEqual(Object.keys(a).sort(), ["author", "authorName", "closeDate", "coBrokeAgent", "commissionPercent", "currency", "dateAgreed", "listing", "priceMinor", "purchaserAgent", "purchaserAttorney", "purchaserName", "vendorAttorney"]);
});

test("a listing carries no link back to its transactions, so reading a listing never brings them", () => {
  const listing = schema("canonical-listing").attributes;
  for (const [name, attr] of Object.entries(listing))
    assert.notEqual(attr.target, "api::listing-transaction.listing-transaction", `canonical-listing.${name} points at transactions`);
});

test("the transaction API is the core one, like the notes API", () => {
  const dir = path.join(__dirname, "..", "api", "listing-transaction");
  for (const part of ["controllers", "routes", "services"]) {
    const src = require("node:fs").readFileSync(path.join(dir, part, "listing-transaction.js"), "utf8");
    assert.match(src, /api::listing-transaction\.listing-transaction/, part);
  }
});

// Public user area (26 Oct 2026, plan A1, A2 and A6; TEC-1909).
test("an account keeps when its password last changed and when a reset was last asked for, never shown", () => {
  const user = require(path.join(__dirname, "..", "extensions", "users-permissions", "content-types", "user", "schema.json")).attributes;
  assert.deepEqual(user.passwordChangedAt, { type: "datetime", private: true, configurable: false });
  assert.deepEqual(user.resetPasswordRequestedAt, { type: "datetime", private: true, configurable: false });
});

test("a saved property remembers the price and status the person was last told about", () => {
  const a = schema("favorite").attributes;
  assert.deepEqual(a.notifiedPriceMinor, { type: "biginteger" });
  assert.deepEqual(a.notifiedStatus, { type: "string" });
});

// Owner, 27 Oct: Full Service is set by staff with a switch, never worked out from the staff
// included.
test("a listing has a Full Service switch, off unless staff turn it on", () => {
  assert.deepEqual(schema("canonical-listing").attributes.fullService, { type: "boolean", default: false });
});
