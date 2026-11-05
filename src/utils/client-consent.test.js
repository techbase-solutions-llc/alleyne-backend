// The office's client page reads one account's consent record (client accounts plan, 5 Nov 2026,
// section 5). Those fields are private: no role reads them, only the website's server token.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CONSENT_FIELDS, serverTokenOnly, parseUserId, consentFields, readConsent } = require("./client-consent");

const token = (type) => ({ state: { auth: { strategy: { name: "api-token" }, credentials: { type } } } });

test("only the website's full-access server token passes; every role and every other token is refused", () => {
  assert.equal(serverTokenOnly(token("full-access")), true);
  assert.equal(serverTokenOnly(token("read-only")), false);
  assert.equal(serverTokenOnly(token("custom")), false);
  // A signed-in client or staff member, whatever their role.
  for (const role of ["authenticated", "agent", "agencyowner", "moderator"])
    assert.equal(serverTokenOnly({ state: { user: { id: 3, role: { type: role } }, auth: { strategy: { name: "users-permissions" }, credentials: { id: 3 } } } }), false, role);
  // No token at all (the Public role).
  assert.equal(serverTokenOnly({ state: {} }), false);
  assert.equal(serverTokenOnly({}), false);
  assert.equal(serverTokenOnly(undefined), false);
  // A user on the request alongside a token is refused too.
  const both = token("full-access");
  both.state.user = { id: 3 };
  assert.equal(serverTokenOnly(both), false);
});

test("the policy file is the same check", () => {
  const policy = require("../api/client-consent/policies/server-token-only");
  assert.equal(policy(token("full-access")), true);
  assert.equal(policy(token("read-only")), false);
  assert.equal(policy({ state: { user: { id: 1 }, auth: { strategy: { name: "users-permissions" } } } }), false);
  assert.equal(policy({ state: {} }), false);
});

test("an account id is a positive whole number, anything else is no account", () => {
  assert.equal(parseUserId("12"), 12);
  assert.equal(parseUserId(7), 7);
  for (const bad of ["0", "-1", "abc", "1.5", "12abc", "", " 3", undefined, null, "99999999999999999999"])
    assert.equal(parseUserId(bad), null, String(bad));
});

test("the answer carries the seven consent fields and nothing else", () => {
  assert.deepEqual(CONSENT_FIELDS, [
    "marketingOptIn", "marketingOptInAt", "marketingConsentText", "marketingConsentVersion",
    "marketingConsentSource", "marketingOptOutAt", "marketingOptOutSource",
  ]);
  const row = {
    id: 5, email: "ann@example.com", password: "$2a$hash", resetPasswordToken: "r", confirmationToken: "c",
    marketingOptIn: true, marketingOptInAt: "2026-10-26T10:00:00.000Z", marketingConsentText: "Yes, email me.",
    marketingConsentVersion: "2026-10-26", marketingConsentSource: "signup", marketingOptOutAt: null, marketingOptOutSource: null,
  };
  const out = consentFields(row);
  assert.deepEqual(Object.keys(out), CONSENT_FIELDS);
  assert.equal(out.marketingOptIn, true);
  assert.equal(out.marketingConsentSource, "signup");
  assert.equal(out.marketingOptOutAt, null);
  // Missing fields come back as null; opt-in is a plain boolean.
  assert.deepEqual(consentFields({ id: 9 }), Object.fromEntries(CONSENT_FIELDS.map((f) => [f, f === "marketingOptIn" ? false : null])));
  assert.equal(consentFields({ marketingOptIn: 1 }).marketingOptIn, true);
});

test("reading one account asks the database for the consent fields only, and says when there is none", async () => {
  const asked = [];
  const db = {
    query(uid) {
      return {
        async findOne(args) {
          asked.push({ uid, ...args });
          return args.where.id === 5 ? { id: 5, marketingOptIn: false, marketingOptOutSource: "office", password: "x" } : null;
        },
      };
    },
  };
  const found = await readConsent(db, "5");
  assert.equal(found.marketingOptOutSource, "office");
  assert.equal("password" in found, false);
  assert.equal("id" in found, false);
  assert.deepEqual(asked[0], { uid: "plugin::users-permissions.user", where: { id: 5 }, select: CONSENT_FIELDS });
  assert.equal(await readConsent(db, "6"), null);
  // A malformed id never reaches the database.
  assert.equal(await readConsent(db, "abc"), null);
  assert.equal(asked.length, 2);
});

test("the controller refuses anything but the server token, answers 404 for no account, and the consent otherwise", async () => {
  const controller = require("../api/client-consent/controllers/client-consent");
  const db = { query: () => ({ findOne: async ({ where }) => (where.id === 5 ? { marketingOptIn: true, marketingOptOutSource: null } : null) }) };
  global.strapi = { db };
  try {
    const ctxFor = (state, userId) => {
      const ctx = { state, params: { userId }, body: undefined, status: undefined };
      ctx.forbidden = () => { ctx.status = 403; };
      ctx.notFound = () => { ctx.status = 404; };
      return ctx;
    };
    const jwt = ctxFor({ user: { id: 5 }, auth: { strategy: { name: "users-permissions" } } }, "5");
    await controller.findOne(jwt);
    assert.equal(jwt.status, 403);
    assert.equal(jwt.body, undefined);

    const missing = ctxFor(token("full-access").state, "6");
    await controller.findOne(missing);
    assert.equal(missing.status, 404);

    const ok = ctxFor(token("full-access").state, "5");
    await controller.findOne(ok);
    assert.equal(ok.status, undefined);
    assert.equal(ok.body.marketingOptIn, true);
    assert.deepEqual(Object.keys(ok.body), CONSENT_FIELDS);
  } finally {
    delete global.strapi;
  }
});
