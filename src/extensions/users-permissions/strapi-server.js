// src/extensions/users-permissions/strapi-server.js
'use strict';
const { limitConfirmationResend, pinSignInLimitKey } = require('../../utils/auth-routes');

// Confirmation emails can be resent only a few times an hour per address, and the sign-in
// limit counts per account tried, which the caller cannot change (review, 8 Oct).
module.exports = (plugin) => {
  const api = plugin.routes['content-api'];
  api.routes = pinSignInLimitKey(limitConfirmationResend(api.routes));
  return plugin;
};
