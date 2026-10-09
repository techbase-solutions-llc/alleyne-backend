// src/api/saved-search/routes/alerts-off.js
'use strict';
// The stop-alerts link in alert emails (review, 8 Oct 2026): the site's server token only.
module.exports = {
  routes: [
    { method: 'POST', path: '/saved-searches/alerts-off', handler: 'saved-search.alertsOff', config: { policies: [] } },
  ],
};
