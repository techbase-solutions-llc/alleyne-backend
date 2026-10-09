// src/utils/invite-code.js
'use strict';
const crypto = require('crypto');

/** Invitation codes start with this, so an open code can be told apart from one Strapi's
    forgot-password made (review, 8 Oct 2026). /auth/reset-password takes any string. */
const INVITE_PREFIX = 'inv-';

/** The same randomness Strapi's forgot-password uses, marked as an invitation code. */
const newInviteCode = () => INVITE_PREFIX + crypto.randomBytes(64).toString('hex');

/** True only for a request made with an API token and no user. */
const tokenOnly = (ctx) => !ctx.state?.user && ctx.state?.auth?.strategy?.name === 'api-token';

/** What the site may know about a user's set-password code without ever reading it (review,
    8 Oct 2026): whether one is waiting (`open`), whether `given` is that one (`current`;
    null when nothing was asked) and whether the waiting one is an invitation code
    (`invitation`), not a forgotten-password one. Compared in constant time. */
function codeStatus(stored, given) {
  const open = typeof stored === 'string' && stored.length > 0;
  const invitation = open && stored.startsWith(INVITE_PREFIX);
  if (given === undefined || given === null) return { open, current: open ? null : false, invitation };
  if (!open || typeof given !== 'string') return { open, current: false, invitation };
  const a = Buffer.from(stored), b = Buffer.from(given);
  return { open, current: a.length === b.length && crypto.timingSafeEqual(a, b), invitation };
}

/** Nobody but the invitation ever had a way into this account: its invitation code is still
    open and nothing has been saved on it. An invitation code can be open after a password
    was set (an expired link used without its m and s, then a resend), so favourites and
    saved searches count as use too (review, 8 Oct 2026). Anything unclear keeps the account. */
function unusedInvitation(status, counts) {
  return Boolean(status && status.open && status.invitation) && counts.favourites === 0 && counts.savedSearches === 0;
}

module.exports = { newInviteCode, tokenOnly, codeStatus, unusedInvitation, INVITE_PREFIX };
