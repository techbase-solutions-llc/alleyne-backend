// src/utils/account-security.js
'use strict';
// Account rules the backend enforces itself, so a direct call cannot skip the website's checks
// (public user area plan, 26 Oct 2026, section A; TEC-1909). Pure: no Strapi here. Wired in
// src/extensions/users-permissions/strapi-server.js through utils/auth-overrides.js.

const { INVITE_PREFIX } = require('./invite-code');

/** How long a forgotten-password link works (A1). */
const RESET_CODE_MINUTES = 60;
const RESET_EXPIRED_MESSAGE = 'This reset link has expired. Ask for a new one.';
/** The website's own rule (A3), now the backend's too. */
const PASSWORD_MIN = 8;

/** Milliseconds from a stored datetime (Date, number or ISO text), or NaN. */
function msOf(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v) return Date.parse(v);
  return NaN;
}

/** True when a forgotten-password code is too old to use. A code with no request time was made
    before this rule existed and is refused too. Invitation codes are left to the website's
    7-day rule (invite-link.ts INVITE_DAYS). */
function resetCodeExpired({ code, requestedAt, now = Date.now() }) {
  if (typeof code === 'string' && code.startsWith(INVITE_PREFIX)) return false;
  const at = msOf(requestedAt);
  if (!Number.isFinite(at)) return true;
  return now - at > RESET_CODE_MINUTES * 60 * 1000;
}

/** True when a sign-in token was issued before the account's last password change (A2). The
    token's iat is in whole seconds, so the change time is rounded down: the token that
    change-password and reset-password hand back, issued just after, stays good. */
function tokenRevoked({ iat, passwordChangedAt }) {
  const changed = msOf(passwordChangedAt);
  if (!Number.isFinite(changed)) return false;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return true;
  return iat < Math.floor(changed / 1000);
}

/** The data of a user save with its stamps: passwordChangedAt when a password is written,
    resetPasswordRequestedAt when a reset code is written. Values a caller sent for either are
    dropped, so the stored ones stay. */
function userUpdateStamps({ data, now = new Date() }) {
  const out = { ...(data || {}) };
  delete out.passwordChangedAt;
  delete out.resetPasswordRequestedAt;
  if (typeof out.password === 'string' && out.password) out.passwordChangedAt = now;
  if (typeof out.resetPasswordToken === 'string' && out.resetPasswordToken) out.resetPasswordRequestedAt = now;
  return out;
}

function passwordProblem(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN ? null : `Password must be at least ${PASSWORD_MIN} characters.`;
}

/** The first thing wrong with a sign-up, or null. The site sends the person's name as
    username. */
function registerProblem({ username, password, email }) {
  if (typeof username !== 'string' || !username.trim()) return 'Enter your name.';
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter your email address.';
  return passwordProblem(password);
}

/** At most one "you already have an account" email per address in each window. Kept in memory:
    Render runs one instance, and a restart only allows one more email. */
function noticeLimiter({ windowMs = 60 * 60 * 1000, maxKeys = 5000 } = {}) {
  const last = new Map();
  return {
    allow(address, now = Date.now()) {
      const key = String(address || '').trim().toLowerCase();
      if (!key) return false;
      const at = last.get(key);
      if (at !== undefined && now - at <= windowMs) return false;
      last.delete(key);
      last.set(key, now);
      // Oldest first (Map keeps insertion order): drop the expired, then the oldest over the cap.
      for (const [k, t] of last) {
        if (last.size <= maxKeys && now - t <= windowMs) break;
        last.delete(k);
      }
      return true;
    },
    size: () => last.size,
  };
}

module.exports = {
  RESET_CODE_MINUTES, RESET_EXPIRED_MESSAGE, PASSWORD_MIN, resetCodeExpired, tokenRevoked,
  userUpdateStamps, registerProblem, passwordProblem, noticeLimiter,
};
