// src/utils/invite-code.js
'use strict';
const crypto = require('crypto');

/** The same shape Strapi's forgot-password makes, so /auth/reset-password accepts it. */
const newInviteCode = () => crypto.randomBytes(64).toString('hex');

/** True only for a request made with an API token and no user. */
const tokenOnly = (ctx) => !ctx.state?.user && ctx.state?.auth?.strategy?.name === 'api-token';

module.exports = { newInviteCode, tokenOnly };
