// Runs src/index.js bootstrap against a stand-in Strapi, so a mistake that stops the backend
// starting fails npm test (review, 8 Oct 2026: a name clash threw a TypeError at boot).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootstrap } = require("../index");
const { PUBLIC_PERMISSIONS } = require("./role-permissions");

function stubStrapi() {
  const created = [];
  const deleted = [];
  const roles = {
    authenticated: { id: 1, permissions: [
      { id: 11, action: "api::favorite.favorite.find" },
      { id: 12, action: "api::lead.lead.find" },
      { id: 13, action: "api::listing-note.listing-note.find" },
    ] },
    public: { id: 2, permissions: [
      { id: 21, action: "api::article.article.find" },
      { id: 22, action: "api::property-submission.property-submission.create" },
      { id: 23, action: "plugin::users-permissions.auth.sendEmailConfirmation" },
      { id: 24, action: "api::listing-note.listing-note.findOne" },
    ] },
    // Custom roles (TEC-1909): a notes grant ticked in the admin panel must go too.
    agent: { id: 3, name: "Agent", permissions: [
      { id: 31, action: "api::listing-note.listing-note.find" },
      { id: 32, action: "api::canonical-listing.canonical-listing.find" },
    ] },
    moderator: { id: 4, name: "Moderator", permissions: [
      { id: 41, action: "api::listing-note.listing-note.update" },
    ] },
  };
  const query = (uid) => ({
    findOne: async ({ where } = {}) => (uid === "plugin::users-permissions.role" && where && roles[where.type]) || null,
    findMany: async () => (uid === "plugin::users-permissions.role" ? Object.values(roles) : []),
    create: async ({ data }) => { created.push([uid, data.action ?? data.name, data.role]); return { id: 99 }; },
    delete: async ({ where }) => { deleted.push(where.id); return {}; },
  });
  const knex = Object.assign(() => ({ whereNull() { return this; }, whereNotNull() { return this; }, whereNot() { return this; }, where() { return this; }, update: async () => 0 }), {
    raw: async () => ({}),
    schema: { hasTable: async () => true },
    fn: { now: () => "now" },
  });
  const stores = new Map();
  const strapi = {
    query,
    log: { info() {}, warn() {}, error() {} },
    db: { connection: knex, metadata: { get: () => ({ tableName: "canonical_listings", attributes: new Proxy({}, { get: (_t, a) => ({ columnName: String(a) }) }) }) } },
    store: () => ({ get: async ({ key }) => stores.get(key), set: async ({ key, value }) => { stores.set(key, value); } }),
    service: () => ({}),
  };
  return { strapi, created, deleted };
}

test("the backend starts: bootstrap runs to the end and applies the role changes", async () => {
  const { strapi, created, deleted } = stubStrapi();
  await bootstrap({ strapi });
  // Authenticated: the old lead.find grant goes, the favourite grant stays.
  assert.ok(deleted.includes(12));
  assert.ok(!deleted.includes(11));
  // Public: submission create and confirmation resend go, article reading stays.
  assert.ok(deleted.includes(22));
  assert.ok(deleted.includes(23));
  assert.ok(!deleted.includes(21));
  // Listing notes are held by no role (session 4, TEC-1909): a grant ticked in the admin
  // panel is removed on the next boot.
  assert.ok(deleted.includes(13));
  assert.ok(deleted.includes(24));
  // Custom roles too (TEC-1909): Agent and Moderator lose their notes grants, nothing else.
  assert.ok(deleted.includes(31));
  assert.ok(deleted.includes(41));
  assert.ok(!deleted.includes(32));
  // Missing public grants are created for the public role.
  const publicCreated = created.filter(([uid, , role]) => uid === "plugin::users-permissions.permission" && role === 2).map(([, a]) => a);
  assert.deepEqual(publicCreated.sort(), PUBLIC_PERMISSIONS.filter((a) => a !== "api::article.article.find").sort());
});
