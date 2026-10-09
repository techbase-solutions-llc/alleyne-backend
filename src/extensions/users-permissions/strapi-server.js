// src/extensions/users-permissions/strapi-server.js
'use strict';
const { limitConfirmationResend } = require('../../utils/auth-routes');

// Confirmation emails can be resent only a few times an hour per address (review, 8 Oct).
module.exports = (plugin) => {
  const api = plugin.routes['content-api'];
  api.routes = limitConfirmationResend(api.routes);
  return plugin;
};
