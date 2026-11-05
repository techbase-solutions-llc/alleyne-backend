// The office's client page reads one account's saved properties and saved searches (client
// accounts plan, 5 Nov 2026, section 2): when each property was saved, and every search with its
// alert switch, on or off. Server token only, as for the consent record.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SAVED_MAX, SEARCHES_MAX, savedItem, searchItem, readClientSaved } = require("./client-saved");
const { serverTokenOnly } = require("./client-consent");

const token = (type) => ({ state: { auth: { strategy: { name: "api-token" }, credentials: { type } } } });

test("the route uses the consent endpoint's server-token-only policy, the same check", () => {
  const routes = require("../api/client-saved/routes/client-saved").routes;
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0], {
    method: "GET",
    path: "/client-saved/:userId",
    handler: "client-saved.findOne",
    config: { policies: ["api::client-consent.server-token-only"] },
  });
  const policy = require("../api/client-consent/policies/server-token-only");
  assert.equal(policy(token("full-access")), true);
  for (const ctx of [
    token("read-only"),
    token("custom"),
    { state: {} },
    {},
    { state: { user: { id: 3, role: { type: "authenticated" } }, auth: { strategy: { name: "users-permissions" } } } },
    { state: { user: { id: 3, role: { type: "agencyowner" } }, auth: { strategy: { name: "users-permissions" } } } },
  ])
    assert.equal(policy(ctx), serverTokenOnly(ctx));
  const both = token("full-access");
  both.state.user = { id: 3 };
  assert.equal(policy(both), false);
});

test("a saved property carries its id, when it was saved, the listing's id, title and slug, and the last alert", () => {
  const row = {
    id: 7, createdAt: "2026-10-30T09:00:00.000Z", notifiedPriceMinor: "450000000", notifiedStatus: "active",
    user: { id: 5, email: "ann@example.com" },
    listing: { id: 31, title: "Villa", slug: "villa", priceMinor: 1, status: "active" },
  };
  assert.deepEqual(savedItem(row), {
    id: 7, createdAt: "2026-10-30T09:00:00.000Z",
    listing: { id: 31, title: "Villa", slug: "villa" },
    lastNotifiedChange: { priceMinor: 450000000, status: "active" },
  });
  // No alert yet, and a listing that has been deleted.
  assert.deepEqual(savedItem({ id: 8, createdAt: null, notifiedPriceMinor: null, notifiedStatus: null, listing: null }), {
    id: 8, createdAt: null, listing: null, lastNotifiedChange: null,
  });
  // Status told but no price, and a listing without a title or slug.
  assert.deepEqual(savedItem({ id: 9, notifiedStatus: "sold", listing: { id: 4 } }), {
    id: 9, createdAt: null, listing: { id: 4, title: null, slug: null }, lastNotifiedChange: { priceMinor: null, status: "sold" },
  });
  assert.equal(savedItem({ id: 10, notifiedPriceMinor: "abc" }).lastNotifiedChange, null);
});

test("a saved search carries its name, alert switch, last alert, saved date and client label, never its owner or query", () => {
  const row = {
    id: 3, name: "Two beds west", alertEnabled: false, lastAlertedAt: null, createdAt: "2026-10-01T00:00:00.000Z",
    clientName: "The Smiths", clientNote: "private", filtersJson: { query: "a=b", summary: "2+ beds, St James" },
    user: { id: 5, email: "ann@example.com" },
  };
  assert.deepEqual(searchItem(row), {
    id: 3, name: "Two beds west", alertEnabled: false, lastAlertedAt: null, createdAt: "2026-10-01T00:00:00.000Z",
    clientName: "The Smiths", summary: "2+ beds, St James",
  });
  assert.deepEqual(searchItem({ id: 4, alertEnabled: 1 }), {
    id: 4, name: "", alertEnabled: true, lastAlertedAt: null, createdAt: null, clientName: null, summary: "",
  });
});

function fakeDb({ users = [5], favourites = [], searches = [] } = {}) {
  const asked = [];
  const db = {
    query(uid) {
      return {
        async findOne(args) {
          asked.push({ uid, op: "findOne", ...args });
          return users.includes(args.where.id) ? { id: args.where.id } : null;
        },
        async findMany(args) {
          asked.push({ uid, op: "findMany", ...args });
          const rows = uid === "api::favorite.favorite" ? favourites : searches;
          return rows.filter((r) => r.user?.id === args.where.user.id);
        },
      };
    },
  };
  return { db, asked };
}

test("one account's saved things: its own rows only, newest first, bounded", async () => {
  const { db, asked } = fakeDb({
    favourites: [
      { id: 1, createdAt: "2026-10-01T00:00:00.000Z", user: { id: 5 }, listing: { id: 31, title: "Villa", slug: "villa" } },
      { id: 2, createdAt: "2026-10-02T00:00:00.000Z", user: { id: 6 }, listing: { id: 32, title: "Other", slug: "other" } },
    ],
    searches: [
      { id: 11, name: "On", alertEnabled: true, user: { id: 5 } },
      { id: 12, name: "Off", alertEnabled: false, user: { id: 5 } },
      { id: 13, name: "Someone else", alertEnabled: false, user: { id: 6 } },
    ],
  });
  const out = await readClientSaved(db, "5");
  assert.deepEqual(out.saved.map((s) => s.id), [1]);
  assert.deepEqual(out.searches.map((s) => [s.id, s.alertEnabled]), [[11, true], [12, false]]);
  assert.doesNotMatch(JSON.stringify(out), /Other|Someone else/);

  const fav = asked.find((a) => a.uid === "api::favorite.favorite");
  assert.deepEqual(fav.where, { user: { id: 5 } });
  assert.deepEqual(fav.select, ["id", "createdAt", "notifiedPriceMinor", "notifiedStatus"]);
  assert.deepEqual(fav.populate, { user: { select: ["id"] }, listing: { select: ["id", "title", "slug"] } });
  assert.deepEqual(fav.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(fav.limit, SAVED_MAX);
  const srch = asked.find((a) => a.uid === "api::saved-search.saved-search");
  assert.deepEqual(srch.where, { user: { id: 5 } });
  assert.equal("alertEnabled" in srch.where, false);
  assert.equal(srch.select.includes("clientNote"), false);
  assert.equal(srch.limit, SEARCHES_MAX);
  // The owner check reads the id and nothing else.
  assert.deepEqual(asked.find((a) => a.op === "findOne"), { uid: "plugin::users-permissions.user", op: "findOne", where: { id: 5 }, select: ["id"] });
});

test("a row the database hands back for another account is dropped, not shown", async () => {
  const db = {
    query(uid) {
      return {
        findOne: async () => ({ id: 5 }),
        // A query that ignored the where: every account's rows.
        findMany: async () => (uid === "api::favorite.favorite"
          ? [{ id: 1, user: { id: 5 } }, { id: 2, user: { id: 6 } }, { id: 3, user: null }]
          : [{ id: 11, user: { id: 6 } }]),
      };
    },
  };
  const out = await readClientSaved(db, 5);
  assert.deepEqual(out.saved.map((s) => s.id), [1]);
  assert.deepEqual(out.searches, []);
});

test("no account, or a malformed id, is no answer, and a malformed id never reaches the database", async () => {
  const { db, asked } = fakeDb();
  assert.equal(await readClientSaved(db, "6"), null);
  assert.equal(asked.filter((a) => a.op === "findMany").length, 0);
  for (const bad of ["abc", "0", "-1", "1.5", "", undefined, "99999999999999999999"]) assert.equal(await readClientSaved(db, bad), null, String(bad));
  assert.equal(asked.length, 1);
  // An account with nothing saved.
  assert.deepEqual(await readClientSaved(db, "5"), { saved: [], searches: [] });
});

test("the controller refuses anything but the server token, answers 404 for no account, and the saved things otherwise", async () => {
  const controller = require("../api/client-saved/controllers/client-saved");
  const { db } = fakeDb({ favourites: [{ id: 1, createdAt: "2026-10-01T00:00:00.000Z", user: { id: 5 }, listing: null }] });
  global.strapi = { db };
  try {
    const ctxFor = (state, userId) => {
      const ctx = { state, params: { userId }, body: undefined, status: undefined };
      ctx.forbidden = () => { ctx.status = 403; };
      ctx.notFound = () => { ctx.status = 404; };
      return ctx;
    };
    // The client's own JWT is refused, even for their own id.
    const jwt = ctxFor({ user: { id: 5 }, auth: { strategy: { name: "users-permissions" } } }, "5");
    await controller.findOne(jwt);
    assert.equal(jwt.status, 403);
    assert.equal(jwt.body, undefined);

    const readOnly = ctxFor(token("read-only").state, "5");
    await controller.findOne(readOnly);
    assert.equal(readOnly.status, 403);

    for (const id of ["6", "abc"]) {
      const missing = ctxFor(token("full-access").state, id);
      await controller.findOne(missing);
      assert.equal(missing.status, 404, id);
    }

    const ok = ctxFor(token("full-access").state, "5");
    await controller.findOne(ok);
    assert.equal(ok.status, undefined);
    assert.deepEqual(ok.body, { saved: [{ id: 1, createdAt: "2026-10-01T00:00:00.000Z", listing: null, lastNotifiedChange: null }], searches: [] });
  } finally {
    delete global.strapi;
  }
});
