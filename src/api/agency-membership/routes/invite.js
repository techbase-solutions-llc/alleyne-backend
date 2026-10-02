// src/api/agency-membership/routes/invite.js
'use strict';
module.exports = {
  routes: [
    { method: 'POST', path: '/agency-memberships/invite-code', handler: 'invite.code', config: { policies: [] } },
  ],
};
