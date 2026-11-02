// src/api/page-view-day/routes/add.js
'use strict';
// The website's Web Analytics drain adds each batch's counts here (TEC-1344). Server token only.
module.exports = {
  routes: [
    { method: 'POST', path: '/page-view-days/add', handler: 'page-view-day.add', config: { policies: [] } },
  ],
};
