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
    if (mw.some((m) => (typeof m === 'string' ? m : m && m.name) === RATE_LIMIT)) return r;
    return { ...r, config: { ...r.config, middlewares: [...mw, { name: RATE_LIMIT, config: RESEND_LIMIT }] } };
  });
}

module.exports = { limitConfirmationResend, RESEND_LIMIT };
