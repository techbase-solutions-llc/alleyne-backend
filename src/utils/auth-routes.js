// src/utils/auth-routes.js
'use strict';

/** At most 3 confirmation emails an hour for each address and caller (review, 8 Oct 2026). */
const RESEND_LIMIT = { interval: { min: 60 }, max: 3 };
const RATE_LIMIT = 'plugin::users-permissions.rateLimit';

/**
 * Strapi's POST /auth/send-email-confirmation has no rate limit, unlike the other auth
 * routes, so the same address could be emailed over and over. This adds the plugin's own
 * limiter to that route, with a tighter allowance; it counts per email address and
 * caller address. Used by src/extensions/users-permissions/strapi-server.js.
 */
function limitConfirmationResend(routes) {
  return routes.map((r) => {
    if (r.handler !== 'auth.sendEmailConfirmation') return r;
    const mw = (r.config && r.config.middlewares) || [];
    if (mw.some(isRateLimit)) return r;
    return { ...r, config: { ...r.config, middlewares: [...mw, { name: RATE_LIMIT, config: RESEND_LIMIT }] } };
  });
}

/**
 * Strapi's limiter counts sign-in tries per `email` field, path and caller address. Sign-in
 * itself reads `identifier`, so `email` was a free field: a new made-up value on every try
 * gave a fresh allowance, and passwords could be guessed without ever being slowed down
 * (review, 8 Oct 2026). This step runs just before the limiter and overwrites `email` with
 * the account being tried, so the allowance is per account and caller and cannot be reset.
 * Sign-in ignores `email` (its body check allows unknown fields), so nothing else changes.
 */
async function signInLimitKey(ctx, next) {
  const body = ctx.request && ctx.request.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    body.email = String(body.identifier ?? '').trim().toLowerCase();
  }
  return next();
}

const isRateLimit = (m) => (typeof m === 'string' ? m : m && m.name) === RATE_LIMIT;

/** Puts signInLimitKey in front of the limiter on POST /auth/local only. Used by
    src/extensions/users-permissions/strapi-server.js. */
function pinSignInLimitKey(routes) {
  return routes.map((r) => {
    if (r.handler !== 'auth.callback' || r.method !== 'POST' || r.path !== '/auth/local') return r;
    const mw = (r.config && r.config.middlewares) || [];
    if (mw.includes(signInLimitKey)) return r;
    const at = mw.findIndex(isRateLimit);
    const next = at < 0 ? [signInLimitKey, ...mw] : [...mw.slice(0, at), signInLimitKey, ...mw.slice(at)];
    return { ...r, config: { ...r.config, middlewares: next } };
  });
}

module.exports = { limitConfirmationResend, RESEND_LIMIT, pinSignInLimitKey, signInLimitKey };
