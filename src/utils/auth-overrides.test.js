'use strict';
// Run: npm test
// The users-permissions changes of the public user area plan, section A (26 Oct 2026;
// TEC-1909), run against a stand-in Strapi. The live behaviour was also checked on a local
// backend with a throwaway database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  withTokenRevocation, wrapRegister, wrapResetPassword, wrapChangePassword, userLifecycles, sendAccountNotice, NAME_TAKEN,
} = require('./auth-overrides');
const { noticeLimiter, RESET_EXPIRED_MESSAGE } = require('./account-security');

const USER = 'plugin::users-permissions.user';
const SECRET = 'test-secret';
const NOW = Date.parse('2026-10-26T12:00:00Z');

/** A stand-in Strapi: users in memory, emails and confirmation sends recorded. */
function fakeStrapi(users = []) {
  const sent = [];
  const confirmations = [];
  const removed = [];
  const matches = (u, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && '$eqi' in v) return String(u[k] ?? '').toLowerCase() === String(v.$eqi).toLowerCase();
      if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(u[k]);
      return u[k] === v;
    });
  const strapi = {
    users,
    sent,
    confirmations,
    removed,
    log: { error() {}, warn() {}, info() {} },
    db: {
      query(uid) {
        if (uid === USER) return {
          findOne: async ({ where }) => users.find((u) => matches(u, where)) ?? null,
          findMany: async ({ where }) => users.filter((u) => matches(u, where)).map(({ id }) => ({ id })),
        };
        return {
          findMany: async () => [],
          deleteMany: async ({ where }) => { removed.push([uid, where.id.$in]); return { count: where.id.$in.length }; },
        };
      },
    },
    store: () => ({
      get: async ({ key }) => {
        if (key === 'email') return { reset_password: { options: { from: { name: 'Alleyne Real Estate', email: 'info@jalbarbados.com' }, response_email: 'info@jalbarbados.com' } } };
        if (key === 'advanced') return { allow_register: true };
        return null;
      },
    }),
    plugin: (name) => ({
      service: (svc) => {
        if (name === 'email' && svc === 'email') return { send: async (o) => { sent.push(o); } };
        if (name === 'users-permissions' && svc === 'user') return { sendConfirmationEmail: async (u) => { confirmations.push(u.email); } };
        throw new Error(`no service ${name}.${svc}`);
      },
    }),
  };
  return strapi;
}

const ctxOf = (body, auth) => {
  const ctx = { request: { body }, state: auth ? { auth: { strategy: { name: auth } } } : {}, body: undefined };
  ctx.send = (b) => { ctx.body = b; };
  return ctx;
};
const env = { SITE_URL: 'https://www.example.com' };
const settle = (list) => Promise.all(list.splice(0));

// ── Sessions end on a password change (A2) ────────────────────────────────────

/** Strapi's own jwt service, as the plugin builds it. */
// (The package's exports hide the file, so it is loaded by path.)
const strapiJwt = require(require('node:path').join(__dirname, '..', '..', 'node_modules', '@strapi', 'plugin-users-permissions', 'server', 'services', 'jwt.js'));

function jwtService(strapi) {
  strapi.config = { get: (k) => (k === 'plugin.users-permissions.jwtSecret' ? SECRET : { expiresIn: '7d' }) };
  global.strapi = strapi;
  return withTokenRevocation(strapiJwt)({ strapi });
}

test('a sign-in token from before the password changed is refused; one from after works', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', passwordChangedAt: new Date(NOW).toISOString() }, { id: 2, email: 'bo@example.com', passwordChangedAt: null }]);
  const svc = jwtService(strapi);
  const old = jwt.sign({ id: 1, iat: Math.floor(NOW / 1000) - 60 }, SECRET);
  const fresh = jwt.sign({ id: 1, iat: Math.floor(NOW / 1000) }, SECRET);
  const never = jwt.sign({ id: 2, iat: 1 }, SECRET);
  await assert.rejects(svc.verify(old), /Invalid token/);
  assert.equal((await svc.verify(fresh)).id, 1);
  assert.equal((await svc.verify(never)).id, 2, 'an account that never changed its password is unaffected');
  // getToken, which the sign-in strategy calls, goes through the same check.
  await assert.rejects(svc.getToken({ request: { header: { authorization: `Bearer ${old}` } } }), /Invalid token/);
  assert.equal((await svc.getToken({ request: { header: { authorization: `Bearer ${fresh}` } } })).id, 1);
  // A token for a deleted account is left to the strategy, which already refuses it.
  assert.equal((await svc.verify(jwt.sign({ id: 9 }, SECRET))).id, 9);
  await assert.rejects(svc.verify('not-a-token'), /Invalid token/);
});

// ── Sign-up (A3) ──────────────────────────────────────────────────────────────

test('sign-up refuses a short password or a missing name before anything else, with a 400', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: true }]);
  let called = 0;
  const register = wrapRegister(async () => { called++; }, { strapi, env });
  for (const body of [
    { username: 'Ann', email: 'new@example.com', password: 'short' },
    { username: '  ', email: 'new@example.com', password: 'long enough' },
    // The same answer for an address that already has an account.
    { username: 'Ann', email: 'ann@example.com', password: 'short' },
  ]) {
    await assert.rejects(register(ctxOf(body)), (e) => e.name === 'ValidationError' && /Password must be at least 8|Enter your name/.test(e.message));
  }
  assert.equal(called, 0);
  assert.equal(strapi.sent.length, 0);
});

test('an address that already has an account gets the same answer as a new one, and no new account', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', username: 'Ann Lee', confirmed: true }]);
  // Strapi's register answers a new sign-up with the account (and no token while email
  // confirmation is on).
  const original = async (ctx) => { ctx.send({ user: { id: 7, username: ctx.request.body.username, email: ctx.request.body.email, confirmed: false, createdAt: 'x' } }); };
  const register = wrapRegister(original, { strapi, env, limiter: noticeLimiter(), now: () => NOW });

  const fresh = ctxOf({ username: 'Bo Ray', email: 'bo@example.com', password: 'long enough' });
  await register(fresh);
  const known = ctxOf({ username: 'Bo Ray', email: 'ANN@example.com', password: 'long enough' });
  await register(known);
  assert.deepEqual(fresh.body, { user: { username: 'Bo Ray', email: 'bo@example.com', confirmed: false } });
  assert.deepEqual(known.body, { user: { username: 'Bo Ray', email: 'ann@example.com', confirmed: false } });
  assert.ok(!('jwt' in known.body));
  // The known address hears about it, once an hour at most.
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, 'ann@example.com');
  assert.equal(strapi.sent[0].subject, 'You already have an Alleyne Real Estate account');
  assert.equal(strapi.sent[0].from, 'Alleyne Real Estate <info@jalbarbados.com>');
  assert.equal(strapi.sent[0].replyTo, 'info@jalbarbados.com');
  assert.match(strapi.sent[0].text, /Sign in: https:\/\/www\.example\.com\/signin/);
  await register(ctxOf({ username: 'X Y', email: 'ann@example.com', password: 'long enough' }));
  assert.equal(strapi.sent.length, 1, 'no second email within the hour');
});

test("the website's server token still gets the new account's id; a known address never gives one away", async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: true }]);
  const original = async (ctx) => { ctx.send({ user: { id: 7, username: 'Bo', email: 'bo@example.com', confirmed: false } }); };
  const register = wrapRegister(original, { strapi, env, limiter: noticeLimiter() });
  const site = ctxOf({ username: 'Bo', email: 'bo@example.com', password: 'long enough' }, 'api-token');
  await register(site);
  assert.equal(site.body.user.id, 7, 'the site records marketing consent on the new account by id');
  const siteKnown = ctxOf({ username: 'Bo', email: 'ann@example.com', password: 'long enough' }, 'api-token');
  await register(siteKnown);
  assert.equal(siteKnown.body.user.id, undefined, 'so a sign-up form can never change an existing account');
  // With confirmation off (local development), a new account is signed in straight away.
  const signedIn = ctxOf({ username: 'Cy', email: 'cy@example.com', password: 'long enough' });
  await wrapRegister(async (ctx) => { ctx.send({ jwt: 'j', user: { id: 8 } }); }, { strapi, env })(signedIn);
  assert.deepEqual(signedIn.body, { jwt: 'j', user: { id: 8 } });
});

test('an unconfirmed account gets its confirmation email again; a blocked one gets nothing', async () => {
  const strapi = fakeStrapi([
    { id: 1, email: 'un@example.com', confirmed: false },
    { id: 2, email: 'blocked@example.com', confirmed: true, blocked: true },
  ]);
  const register = wrapRegister(async () => { throw new Error('must not create'); }, { strapi, env, limiter: noticeLimiter() });
  await register(ctxOf({ username: 'Un', email: 'un@example.com', password: 'long enough' }));
  await register(ctxOf({ username: 'Bl', email: 'blocked@example.com', password: 'long enough' }));
  assert.deepEqual(strapi.confirmations, ['un@example.com']);
  assert.equal(strapi.sent.length, 0);
});

test('with sign-up switched off in the admin panel, every address gets Strapi\'s refusal and nobody is emailed', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: true }]);
  strapi.store = () => ({ get: async ({ key }) => (key === 'advanced' ? { allow_register: false } : null) });
  const { errors } = require('@strapi/utils');
  const original = async () => { throw new errors.ApplicationError('Register action is currently disabled'); };
  const register = wrapRegister(original, { strapi, env, limiter: noticeLimiter() });
  for (const email of ['ann@example.com', 'new@example.com'])
    await assert.rejects(register(ctxOf({ username: 'Ann', email, password: 'long enough' })), /currently disabled/);
  assert.equal(strapi.sent.length, 0);
});

test('a name another account uses is reported as a name clash, not as a taken email', async () => {
  const strapi = fakeStrapi([]);
  const { errors } = require('@strapi/utils');
  const register = wrapRegister(async () => { throw new errors.ApplicationError('Email or Username are already taken'); }, { strapi, env });
  await assert.rejects(register(ctxOf({ username: 'Ann Lee', email: 'new@example.com', password: 'long enough' })), (e) => e.name === 'ApplicationError' && e.message === NAME_TAKEN);
  assert.equal(NAME_TAKEN, 'That name is already used by another account. Add a middle initial or a surname.');
});

// ── Reset links expire (A1) and password notices (D4) ─────────────────────────

test('a reset code asked for over 60 minutes ago is refused with the expiry message', async () => {
  const at = (mins) => new Date(NOW - mins * 60000).toISOString();
  const strapi = fakeStrapi([
    { id: 1, email: 'old@example.com', resetPasswordToken: 'old-code', resetPasswordRequestedAt: at(61) },
    { id: 2, email: 'new@example.com', resetPasswordToken: 'new-code', resetPasswordRequestedAt: at(5) },
    { id: 3, email: 'inv@example.com', resetPasswordToken: 'inv-code', resetPasswordRequestedAt: at(60 * 24 * 3) },
  ]);
  const pending = [];
  let resets = 0;
  const reset = wrapResetPassword(async (ctx) => { resets++; ctx.send({ jwt: 'fresh', user: { id: 1 } }); }, { strapi, env, now: () => NOW, later: (p) => pending.push(p) });

  await assert.rejects(reset(ctxOf({ code: 'old-code', password: 'long enough', passwordConfirmation: 'long enough' })), (e) => e.name === 'ValidationError' && e.message === RESET_EXPIRED_MESSAGE);
  assert.equal(resets, 0);
  await reset(ctxOf({ code: 'new-code', password: 'long enough', passwordConfirmation: 'long enough' }));
  // An invitation code keeps the website's own 7-day rule, and setting a first password
  // through an invitation is not a "your password was changed" moment.
  await reset(ctxOf({ code: 'inv-code', password: 'long enough', passwordConfirmation: 'long enough' }));
  // An unknown code goes on to Strapi, which refuses it as before.
  await reset(ctxOf({ code: 'nobody', password: 'long enough', passwordConfirmation: 'long enough' }));
  assert.equal(resets, 3);
  await settle(pending);
  assert.deepEqual(strapi.sent.map((m) => [m.to, m.subject]), [['new@example.com', 'Your Alleyne Real Estate password was changed']]);
  await assert.rejects(reset(ctxOf({ code: 'new-code', password: 'short', passwordConfirmation: 'short' })), /at least 8/);
});

test('a password change needs 8 characters and tells the account owner by email', async () => {
  const strapi = fakeStrapi([]);
  const pending = [];
  const change = wrapChangePassword(async (ctx) => { ctx.send({ jwt: 'fresh', user: { id: 1 } }); }, { strapi, env, later: (p) => pending.push(p) });
  const ctx = ctxOf({ currentPassword: 'old password', password: 'new password', passwordConfirmation: 'new password' });
  ctx.state.user = { id: 1, email: 'ann@example.com' };
  await change(ctx);
  assert.equal(ctx.body.jwt, 'fresh');
  await settle(pending);
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, 'ann@example.com');
  assert.match(strapi.sent[0].html, /Your password was changed/);
  const short = ctxOf({ currentPassword: 'old password', password: 'short', passwordConfirmation: 'short' });
  short.state.user = { id: 1, email: 'ann@example.com' };
  await assert.rejects(change(short), /at least 8/);
  // A refused change (wrong current password) sends nothing.
  const refused = wrapChangePassword(async () => { throw new Error('The provided current password is invalid'); }, { strapi, env, later: (p) => pending.push(p) });
  await assert.rejects(refused(ctx));
  await settle(pending);
  assert.equal(strapi.sent.length, 1);
});

test('a notice that cannot be sent is logged and never fails the request', async () => {
  const strapi = fakeStrapi([]);
  strapi.plugin = () => ({ service: () => ({ send: async () => { throw new Error('smtp down'); } }) });
  const errors = [];
  strapi.log.error = (m) => errors.push(m);
  assert.equal(await sendAccountNotice(strapi, 'welcome', 'ann@example.com', { env }), false);
  assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('ann@example.com'), 'no address in the log');
  assert.equal(await sendAccountNotice(strapi, 'welcome', '', { env }), false);
});

// ── The user's own lifecycle: stamps, welcome, delete clean-up ────────────────

test('a user save stamps a new password or reset code, and a first confirmation sends the welcome email', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: false }, { id: 2, email: 'bo@example.com', confirmed: true }]);
  const pending = [];
  const life = userLifecycles({ strapi, env, now: () => NOW, later: (p) => pending.push(p) });

  const pw = { params: { where: { id: 1 }, data: { password: 'hash', passwordChangedAt: '1999-01-01' } }, state: {} };
  await life.beforeUpdate(pw);
  assert.deepEqual(pw.params.data, { password: 'hash', passwordChangedAt: new Date(NOW) });

  const code = { params: { where: { id: 1 }, data: { resetPasswordToken: 'abc' } }, state: {} };
  await life.beforeUpdate(code);
  assert.deepEqual(code.params.data.resetPasswordRequestedAt, new Date(NOW));

  const confirm = { params: { where: { id: 1 }, data: { confirmed: true, confirmationToken: null } }, state: {} };
  await life.beforeUpdate(confirm);
  await life.afterUpdate({ ...confirm, result: { id: 1, email: 'ann@example.com', confirmed: true } });
  // Saving an account that was already confirmed (the admin panel sends confirmed every time).
  const again = { params: { where: { id: 2 }, data: { confirmed: true, username: 'Bo' } }, state: {} };
  await life.beforeUpdate(again);
  await life.afterUpdate({ ...again, result: { id: 2, email: 'bo@example.com' } });
  await settle(pending);
  assert.deepEqual(strapi.sent.map((m) => [m.to, m.subject]), [['ann@example.com', 'Welcome to Alleyne Real Estate']]);
});

test("deleting an account takes its saved properties and searches, after the account itself has gone", async () => {
  const strapi = fakeStrapi([{ id: 1 }]);
  strapi.db.query = ((orig) => (uid) => {
    if (uid === 'api::favorite.favorite') return { findMany: async () => [{ id: 10 }], deleteMany: async ({ where }) => { strapi.removed.push([uid, where.id.$in]); return { count: 1 }; } };
    if (uid === 'api::saved-search.saved-search') return { findMany: async () => [{ id: 20 }], deleteMany: async ({ where }) => { strapi.removed.push([uid, where.id.$in]); return { count: 1 }; } };
    return orig(uid);
  })(strapi.db.query);
  const life = userLifecycles({ strapi, env });
  const event = { params: { where: { id: 1 } }, state: {} };
  await life.beforeDelete(event);
  assert.deepEqual(strapi.removed, []);
  await life.afterDelete(event);
  assert.deepEqual(strapi.removed, [['api::favorite.favorite', [10]], ['api::saved-search.saved-search', [20]]]);
  const many = { params: { where: { id: { $in: [1] } } }, state: {} };
  await life.beforeDeleteMany(many);
  await life.afterDeleteMany(many);
  assert.equal(strapi.removed.length, 4);
});

// ── Adversarial review, 26 Oct 2026: no answer may differ between a new and a known address ──

test('Strapi checks the same address the known-address lookup used: trimmed and in lower case', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: true }]);
  const seen = [];
  const register = wrapRegister(async (ctx) => { seen.push(ctx.request.body.email); ctx.send({ user: { id: 7 } }); }, { strapi, env, limiter: noticeLimiter(), now: () => NOW, hash: async () => {} });
  const fresh = ctxOf({ username: 'Bo Ray', email: '  Bo@Example.com ', password: 'long enough' });
  const known = ctxOf({ username: 'Bo Ray', email: '  ANN@example.com ', password: 'long enough' });
  await register(fresh);
  await register(known);
  assert.deepEqual(seen, ['bo@example.com'], "Strapi's own email check would refuse the spaces a known address got past");
  assert.deepEqual(fresh.body, { user: { username: 'Bo Ray', email: 'bo@example.com', confirmed: false } });
  assert.deepEqual(known.body, { user: { username: 'Bo Ray', email: 'ann@example.com', confirmed: false } });
});

test("an address Strapi's own email check refuses is refused before the known-address lookup", async () => {
  // a..b@example.com passes a simple pattern but not Strapi's; were it stored, a known
  // address would have succeeded where a new one failed.
  const strapi = fakeStrapi([{ id: 1, email: 'a..b@example.com', confirmed: true }]);
  let called = 0;
  const register = wrapRegister(async () => { called++; }, { strapi, env, limiter: noticeLimiter(), hash: async () => {} });
  for (const email of ['a..b@example.com', 'c..d@example.com'])
    await assert.rejects(register(ctxOf({ username: 'Ann', email, password: 'long enough' })), (e) => e.name === 'ValidationError' && e.message === 'Enter your email address.');
  assert.equal(called, 0);
  assert.equal(strapi.sent.length, 0);
});

test('a second sign-up with an address within the hour sends nothing, whether the first one made the account or not', async () => {
  // Before: the first try at a new address made the account without touching the limiter,
  // so a second try sent its confirmation again (slow), while a second try at an address
  // that already had an account sent nothing (fast).
  const users = [{ id: 1, email: 'ann@example.com', confirmed: false }];
  const strapi = fakeStrapi(users);
  const original = async (ctx) => {
    users.push({ id: 7, email: ctx.request.body.email, confirmed: false });
    ctx.send({ user: { id: 7, username: ctx.request.body.username, email: ctx.request.body.email, confirmed: false } });
  };
  const register = wrapRegister(original, { strapi, env, limiter: noticeLimiter(), now: () => NOW, hash: async () => {} });
  for (const email of ['ann@example.com', 'bo@example.com']) {
    await register(ctxOf({ username: 'Bo Ray', email, password: 'long enough' }));
    await register(ctxOf({ username: 'Bo Ray', email, password: 'long enough' }));
  }
  assert.deepEqual(strapi.confirmations, ['ann@example.com'], 'the new address got its one email from Strapi, the known one from the backend');
});

test('a known address takes the same password-hashing step a new account takes', async () => {
  const strapi = fakeStrapi([{ id: 1, email: 'ann@example.com', confirmed: true }]);
  const hashed = [];
  const register = wrapRegister(async (ctx) => { ctx.send({ user: { id: 7 } }); }, { strapi, env, limiter: noticeLimiter(), hash: async (p) => { hashed.push(p); } });
  await register(ctxOf({ username: 'Bo Ray', email: 'bo@example.com', password: 'new account' }));
  await register(ctxOf({ username: 'Bo Ray', email: 'ann@example.com', password: 'known one' }));
  // Strapi hashes the new account's password itself; the known address hashes once here.
  assert.deepEqual(hashed, ['known one']);
});
