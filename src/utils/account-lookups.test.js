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
/** A clock that only moves when the wrapper waits or the original "works". */
function clock() {
  let t = 1000;
  return { now: () => t, sleep: async (ms) => { t += ms; }, work: (ms) => { t += ms; } };
}
const quiet = { log: { error() {}, warn() {}, info() {} } };

test('forgot password: unknown, known and failed-send addresses get the same answer after the same wait', async () => {
  const c = clock();
  const answers = [];
  const cases = [
    async (ctx) => { c.work(5); ctx.send({ ok: true }); }, // unknown address: Strapi answers at once
    async (ctx) => { c.work(700); ctx.send({ ok: true }); }, // known: code written and email sent
    async () => { c.work(400); throw new Error('Resend said no'); }, // known, the send failed
  ];
  for (const original of cases) {
    const start = c.now();
    const ctx = ctxOf({ email: 'a@b.co' });
    await wrapForgotPassword(original, { now: c.now, sleep: c.sleep, strapi: quiet })(ctx);
    answers.push({ body: ctx.body, took: c.now() - start });
  }
  for (const a of answers) assert.deepEqual(a.body, { ok: true });
  assert.ok(answers.every((a) => a.took === LOOKUP_MIN_MS), JSON.stringify(answers));
});

test('forgot password: a badly formed request is still refused with Strapi\'s own message', async () => {
  const c = clock();
  const original = async () => { throw new errors.ValidationError('email must be a valid email'); };
  await assert.rejects(wrapForgotPassword(original, { now: c.now, sleep: c.sleep, strapi: quiet })(ctxOf({ email: 'nope' })), errors.ValidationError);
});

test('resend confirmation: confirmed, blocked and unknown addresses get the new-address answer', async () => {
  for (const msg of ['Already confirmed', 'User blocked']) {
    const c = clock();
    const ctx = ctxOf({ email: 'Known@B.co' });
    const original = async () => { throw new errors.ApplicationError(msg); };
    await wrapSendEmailConfirmation(original, { now: c.now, sleep: c.sleep, strapi: quiet })(ctx);
    assert.deepEqual(ctx.body, { email: 'known@b.co', sent: true }, msg);
  }
  const c = clock();
  const ctx = ctxOf({ email: 'new@b.co' });
  await wrapSendEmailConfirmation(async (x) => { x.send({ email: 'new@b.co', sent: true }); }, { now: c.now, sleep: c.sleep, strapi: quiet })(ctx);
  assert.deepEqual(ctx.body, { email: 'new@b.co', sent: true });
  assert.equal(c.now() - 1000, LOOKUP_MIN_MS);
});

test('resend confirmation: an unconfirmed account is sent its email as before', async () => {
  const c = clock();
  let called = 0;
  const ctx = ctxOf({ email: 'wait@b.co' });
  await wrapSendEmailConfirmation(async (x) => { called += 1; c.work(600); x.send({ email: 'wait@b.co', sent: true }); }, { now: c.now, sleep: c.sleep, strapi: quiet })(ctx);
  assert.equal(called, 1);
  assert.deepEqual(ctx.body, { email: 'wait@b.co', sent: true });
});

test('both wrappers are wired into the users-permissions plugin', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'extensions', 'users-permissions', 'strapi-server.js'), 'utf8');
  assert.match(src, /auth\.forgotPassword = wrapForgotPassword\(auth\.forgotPassword\)/);
  assert.match(src, /auth\.sendEmailConfirmation = wrapSendEmailConfirmation\(auth\.sendEmailConfirmation\)/);
});
