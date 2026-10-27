'use strict';
// Run: npm test
// Review, 27 Oct (TEC-1909): forgot password and resend confirmation told a stranger whether an
// address had an account. Strapi answered an unknown address at once but a known one only after
// sending an email (and with a 500 if the send failed), and resend confirmation said "Already
// confirmed" for a confirmed account. Both now give one answer, in about the same time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errors } = require('@strapi/utils');
const { wrapForgotPassword, wrapSendEmailConfirmation, LOOKUP_MIN_MS } = require('./auth-overrides');

const ctxOf = (body) => {
  const ctx = { request: { body }, state: {}, body: undefined };
  ctx.send = (b) => { ctx.body = b; };
  return ctx;
};
const quiet = { log: { error() {}, warn() {}, info() {} } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FLOOR = 40;
/** Runs one request and says how long the answer took. */
async function timed(wrap, original, body) {
  const ctx = ctxOf(body);
  const t0 = Date.now();
  await wrap(original, { strapi: quiet, minMs: FLOOR })(ctx);
  return { body: ctx.body, took: Date.now() - t0 };
}

test('the floor is 1.5 seconds', () => {
  assert.equal(LOOKUP_MIN_MS, 1500);
});

test('forgot password: unknown, known, slow and failed sends all get the same answer at the floor', async () => {
  const cases = [
    async (ctx) => { ctx.send({ ok: true }); }, // unknown address: Strapi answers at once
    async (ctx) => { await wait(10); ctx.send({ ok: true }); }, // known: code written, email sent
    async (ctx) => { await wait(150); ctx.send({ ok: true }); }, // known, a slow mail server
    async () => { await wait(5); throw new Error('Resend said no'); }, // known, the send failed
  ];
  for (const original of cases) {
    const r = await timed(wrapForgotPassword, original, { email: 'a@b.co' });
    assert.deepEqual(r.body, { ok: true });
    assert.ok(r.took >= FLOOR - 5 && r.took < FLOOR + 60, `answered after ${r.took} ms`);
  }
});

test('forgot password: a badly formed request is still refused with Strapi\x27s own message', async () => {
  const original = async () => { throw new errors.ValidationError('email must be a valid email'); };
  await assert.rejects(wrapForgotPassword(original, { strapi: quiet, minMs: FLOOR })(ctxOf({ email: 'nope' })), errors.ValidationError);
});

test('resend confirmation: confirmed, blocked and unknown addresses get the new-address answer', async () => {
  for (const msg of ['Already confirmed', 'User blocked']) {
    const r = await timed(wrapSendEmailConfirmation, async () => { throw new errors.ApplicationError(msg); }, { email: 'Known@B.co' });
    assert.deepEqual(r.body, { email: 'known@b.co', sent: true }, msg);
  }
  const r = await timed(wrapSendEmailConfirmation, async (x) => { x.send({ email: 'new@b.co', sent: true }); }, { email: 'new@b.co' });
  assert.deepEqual(r.body, { email: 'new@b.co', sent: true });
  assert.ok(r.took >= FLOOR - 5);
});

test('resend confirmation: an unconfirmed account is sent its email as before', async () => {
  let called = 0;
  const r = await timed(wrapSendEmailConfirmation, async (x) => { called += 1; await wait(10); x.send({ email: 'wait@b.co', sent: true }); }, { email: 'wait@b.co' });
  assert.equal(called, 1);
  assert.deepEqual(r.body, { email: 'wait@b.co', sent: true });
});

test('both wrappers are wired into the users-permissions plugin', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'extensions', 'users-permissions', 'strapi-server.js'), 'utf8');
  assert.match(src, /auth\.forgotPassword = wrapForgotPassword\(auth\.forgotPassword\)/);
  assert.match(src, /auth\.sendEmailConfirmation = wrapSendEmailConfirmation\(auth\.sendEmailConfirmation\)/);
});

// Review, 27 Oct: a floor alone still leaked when the email send took longer than 1.5 s. The
// answer now goes at the floor whatever the send does; the send finishes in the background.
test('a slow send does not delay the answer: it comes at the floor, the send finishes after', async () => {
  for (const wrap of [wrapForgotPassword, wrapSendEmailConfirmation]) {
    let finished = false;
    let release;
    const gate = new Promise((r) => { release = r; });
    const original = async (ctx) => { await gate; finished = true; ctx.send({ ok: true, email: 'a@b.co', sent: true }); };
    const ctx = ctxOf({ email: 'a@b.co' });
    const t0 = Date.now();
    await wrap(original, { strapi: quiet, minMs: 50 })(ctx);
    const took = Date.now() - t0;
    assert.ok(took >= 45 && took < 1000, `answered after ${took} ms`);
    assert.equal(finished, false, 'the send is still going');
    assert.ok(ctx.body, 'already answered');
    const answered = JSON.stringify(ctx.body);
    release();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(finished, true);
    assert.equal(JSON.stringify(ctx.body), answered, 'the late send does not change the answer');
  }
});

test('a failure after the answer is logged, never thrown', async () => {
  const errors = [];
  const strapi = { log: { error: (m) => errors.push(m), warn() {}, info() {} } };
  const original = async () => { await new Promise((r) => setTimeout(r, 30)); throw new Error('smtp down'); };
  const ctx = ctxOf({ email: 'a@b.co' });
  await wrapForgotPassword(original, { strapi, minMs: 5 })(ctx);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(ctx.body, { ok: true });
  assert.equal(errors.length, 1);
});
