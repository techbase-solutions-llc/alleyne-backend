'use strict';
// One client account's saved properties and saved searches for the office's client page (client
// accounts plan, 5 Nov 2026, section 2). Server token only: no role holds the route
// (src/utils/role-permissions.js revokes it on every boot), and it uses the consent endpoint's
// policy, which refuses anything but the full-access token.
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/client-saved/:userId',
      handler: 'client-saved.findOne',
      config: { policies: ['api::client-consent.server-token-only'] },
    },
  ],
};
