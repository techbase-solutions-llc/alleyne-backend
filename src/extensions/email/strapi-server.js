// src/extensions/email/strapi-server.js
'use strict';
const { withPlainText } = require('../../utils/email-text');

// Every email the backend sends gets a real plain-text part (plan A4, 26 Oct 2026; TEC-1909):
// Strapi's confirmation and reset emails passed their HTML as the text too.
module.exports = (plugin) => {
  const make = plugin.services.email;
  plugin.services.email = (deps) => {
    const svc = make(deps);
    const send = svc.send;
    return { ...svc, send: (options) => send(withPlainText(options)) };
  };
  return plugin;
};
