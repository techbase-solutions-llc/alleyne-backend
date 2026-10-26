// Run: npm test
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  RESET_CODE_MINUTES, RESET_EXPIRED_MESSAGE, PASSWORD_MIN, resetCodeExpired, tokenRevoked,
  userUpdateStamps, registerProblem, passwordProblem, noticeLimiter,
} = require('./account-security');

const T0 = Date.parse('2026-10-26T12:00:00Z');
const min = (n) => n * 60 * 1000;

test('a reset code works for 60 minutes from when it was asked for, then is refused', () => {
  assert.equal(RESET_CODE_MINUTES, 60);
  assert.equal(RESET_EXPIRED_MESSAGE, 'This reset link has expired. Ask for a new one.');
  const requestedAt = new Date(T0).toISOString();
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt, now: T0 + min(59) }), false);
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt, now: T0 + min(60) }), false);
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt, now: T0 + min(60) + 1 }), true);
  // The database may hand back a Date or a number of milliseconds.
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt: new Date(T0), now: T0 + min(61) }), true);
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt: T0, now: T0 + min(1) }), false);
});

test('a reset code with no request time (made before this change) counts as expired', () => {
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt: null, now: T0 }), true);
  assert.equal(resetCodeExpired({ code: 'abc', requestedAt: 'not a date', now: T0 }), true);
});

test('an invitation code keeps its own 7-day rule on the website and is never refused here', () => {
  assert.equal(resetCodeExpired({ code: 'inv-abc', requestedAt: null, now: T0 }), false);
  assert.equal(resetCodeExpired({ code: 'inv-abc', requestedAt: T0 - min(600), now: T0 }), false);
});

test('a sign-in token issued before the password changed is refused; one issued after is not', () => {
  const changed = new Date(T0 + 400).toISOString(); // 12:00:00.400
  const sec = Math.floor(T0 / 1000);
  assert.equal(tokenRevoked({ iat: sec - 1, passwordChangedAt: changed }), true);
  // Same second: the new token from change-password or reset-password must work.
  assert.equal(tokenRevoked({ iat: sec, passwordChangedAt: changed }), false);
  assert.equal(tokenRevoked({ iat: sec + 5, passwordChangedAt: changed }), false);
  assert.equal(tokenRevoked({ iat: sec - 1, passwordChangedAt: new Date(T0) }), true);
  assert.equal(tokenRevoked({ iat: sec - 1, passwordChangedAt: T0 }), true);
});

test('an account that never changed its password keeps every token; a token with no time is refused once it has', () => {
  assert.equal(tokenRevoked({ iat: 1, passwordChangedAt: null }), false);
  assert.equal(tokenRevoked({ iat: 1, passwordChangedAt: undefined }), false);
  assert.equal(tokenRevoked({ iat: 1, passwordChangedAt: 'garbage' }), false);
  assert.equal(tokenRevoked({ iat: undefined, passwordChangedAt: T0 }), true);
  assert.equal(tokenRevoked({ iat: '1700000000', passwordChangedAt: T0 }), true);
});

test('a save that writes a password stamps passwordChangedAt; one that writes a reset code stamps its request time', () => {
  const now = new Date(T0);
  assert.deepEqual(userUpdateStamps({ data: { password: 'hash' }, now }), { password: 'hash', passwordChangedAt: now });
  assert.deepEqual(userUpdateStamps({ data: { resetPasswordToken: 'abc' }, now }), { resetPasswordToken: 'abc', resetPasswordRequestedAt: now });
  // Reset-password writes both: the code is cleared and the password set.
  assert.deepEqual(userUpdateStamps({ data: { resetPasswordToken: null, password: 'hash' }, now }), { resetPasswordToken: null, password: 'hash', passwordChangedAt: now });
  assert.deepEqual(userUpdateStamps({ data: { password: '' }, now }), { password: '' });
  assert.deepEqual(userUpdateStamps({ data: { confirmed: true, username: 'x' }, now }), { confirmed: true, username: 'x' });
  assert.deepEqual(userUpdateStamps({ data: undefined, now }), {});
});

test('nobody can set the stamps directly: a caller-sent value is dropped, so the stored one stays', () => {
  const now = new Date(T0);
  const sent = { passwordChangedAt: '2000-01-01T00:00:00Z', resetPasswordRequestedAt: '2099-01-01T00:00:00Z', username: 'x' };
  const out = userUpdateStamps({ data: sent, now });
  assert.deepEqual(out, { username: 'x' });
  assert.ok(!('passwordChangedAt' in out) && !('resetPasswordRequestedAt' in out));
  assert.deepEqual(userUpdateStamps({ data: { ...sent, password: 'hash' }, now }), { username: 'x', password: 'hash', passwordChangedAt: now });
});

test('sign-up needs a name and a password of at least 8 characters, whatever calls the backend', () => {
  assert.equal(PASSWORD_MIN, 8);
  assert.equal(registerProblem({ username: 'Ann Lee', password: '12345678', email: 'a@b.co' }), null);
  assert.equal(registerProblem({ username: 'Ann Lee', password: '1234567', email: 'a@b.co' }), 'Password must be at least 8 characters.');
  assert.equal(registerProblem({ username: '   ', password: '12345678', email: 'a@b.co' }), 'Enter your name.');
  assert.equal(registerProblem({ password: '12345678', email: 'a@b.co' }), 'Enter your name.');
  assert.equal(registerProblem({ username: 'Ann', email: 'a@b.co' }), 'Password must be at least 8 characters.');
  assert.equal(registerProblem({ username: 'Ann', password: 12345678, email: 'a@b.co' }), 'Password must be at least 8 characters.');
  assert.equal(registerProblem({ username: 'Ann', password: '12345678', email: '' }), 'Enter your email address.');
  assert.equal(registerProblem({ username: 'Ann', password: '12345678', email: 'not-an-email' }), 'Enter your email address.');
  assert.equal(passwordProblem('12345678'), null);
  assert.equal(passwordProblem('short'), 'Password must be at least 8 characters.');
});

test('the already-registered notice goes at most once an hour to an address, whatever its case', () => {
  const limiter = noticeLimiter({ windowMs: min(60) });
  assert.equal(limiter.allow('Ann@Example.com', T0), true);
  assert.equal(limiter.allow('ann@example.com', T0 + min(10)), false);
  assert.equal(limiter.allow('other@example.com', T0 + min(10)), true);
  assert.equal(limiter.allow('ann@example.com', T0 + min(60) + 1), true);
  assert.equal(limiter.allow('', T0), false);
});

test('the notice limiter forgets old addresses so it cannot grow without end', () => {
  const limiter = noticeLimiter({ windowMs: 1000, maxKeys: 3 });
  for (let i = 0; i < 10; i++) limiter.allow(`a${i}@x.co`, T0 + i * 2000);
  assert.ok(limiter.size() <= 3);
});

// Adversarial review, 26 Oct 2026 (TEC-1909): Strapi's register also counts an account whose
// email equals the new username as a clash, so a name written as an email address told a
// caller whether that address had an account ("name already used" or success).
test('a name written as an email address is refused, so the name check cannot test an address', () => {
  assert.equal(registerProblem({ username: 'ann@example.com', password: '12345678', email: 'new@b.co' }), 'Enter your name, not an email address.');
  assert.equal(registerProblem({ username: 'Ann @ home', password: '12345678', email: 'new@b.co' }), 'Enter your name, not an email address.');
  assert.equal(registerProblem({ username: "Ann O'Neil-Lee", password: '12345678', email: 'new@b.co' }), null);
});
