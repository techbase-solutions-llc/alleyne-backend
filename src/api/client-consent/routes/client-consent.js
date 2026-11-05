'use strict';
// One client account's private consent fields for the office's client page (client accounts plan,
// 5 Nov 2026). Server token only: no role holds the route (src/utils/role-permissions.js revokes
// it on every boot), and the policy refuses anything but the full-access token besides.
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/client-consents/:userId',
      handler: 'client-consent.findOne',
      config: { policies: ['api::client-consent.server-token-only'] },
    },
  ],
};
