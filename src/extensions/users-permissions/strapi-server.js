// src/extensions/users-permissions/strapi-server.js
'use strict';
const { limitConfirmationResend, pinSignInLimitKey } = require('../../utils/auth-routes');
const {
  withTokenRevocation, wrapRegister, wrapResetPassword, wrapChangePassword, wrapForgotPassword, wrapSendEmailConfirmation, userLifecycles,
} = require('../../utils/auth-overrides');

// Confirmation emails can be resent only a few times an hour per address, and the sign-in
// limit counts per account tried, which the caller cannot change (review, 8 Oct).
// Public user area (plan section A, 26 Oct 2026; TEC-1909; details in utils/auth-overrides.js):
// tokens from before a password change are refused, reset links last 60 minutes, sign-up
// checks the name and password and never says whether an address has an account, owners are
// told of password changes and welcomed on confirming, and a deleted account takes its saved
// properties and searches with it.
module.exports = (plugin) => {
  const api = plugin.routes['content-api'];
  api.routes = pinSignInLimitKey(limitConfirmationResend(api.routes));

  plugin.services.jwt = withTokenRevocation(plugin.services.jwt);

  const auth = plugin.controllers.auth;
  auth.register = wrapRegister(auth.register);
  auth.resetPassword = wrapResetPassword(auth.resetPassword);
  auth.changePassword = wrapChangePassword(auth.changePassword);
  // Neither says whether an address has an account (review, 27 Oct).
  auth.forgotPassword = wrapForgotPassword(auth.forgotPassword);
  auth.sendEmailConfirmation = wrapSendEmailConfirmation(auth.sendEmailConfirmation);

  plugin.contentTypes.user.lifecycles = { ...(plugin.contentTypes.user.lifecycles || {}), ...userLifecycles() };
  return plugin;
};
