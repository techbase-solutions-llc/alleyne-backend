// src/utils/invite-code.js
'use strict';
const crypto = require('crypto');

/** The same shape Strapi's forgot-password makes, so /auth/reset-password accepts it. */
const newInviteCode = () => crypto.randomBytes(64).toString('hex');

/** True only for a request made with an API token and no user. */
const tokenOnly = (ctx) => !ctx.state?.user && ctx.state?.auth?.strategy?.name === 'api-token';

/** What the site may know about a user's set-password code without ever reading it (review,
    8 Oct 2026): whether one is waiting (`open`) and whether `given` is that one (`current`;
    null when nothing was asked). Compared in constant time. */
function codeStatus(stored, given) {
  const open = typeof stored === 'string' && stored.length > 0;
  if (given === undefined || given === null) return { open, current: open ? null : false };
  if (!open || typeof given !== 'string') return { open, current: false };
  const a = Buffer.from(stored), b = Buffer.from(given);
  return { open, current: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

module.exports = { newInviteCode, tokenOnly, codeStatus };
