// src/api/page-view-day/controllers/page-view-day.js
'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
const { isServerToken } = require('../../../utils/favourite-token-list');
const { checkRows, addRows } = require('../../../utils/page-view-days');

module.exports = createCoreController('api::page-view-day.page-view-day', () => ({
  /** Add one drain batch's counts: { rows: [{ day, dimension, value, views, visitors }] }, at
      most 2,000 rows. Each key is created or increased in one statement, so batches arriving
      together both count. The website's full-access server token only: no role holds it. */
  async add(ctx) {
    if (ctx.state.user || !isServerToken(ctx)) return ctx.forbidden();
    const checked = checkRows(ctx.request.body);
    if (checked.error) return ctx.badRequest(checked.error);
    const added = await addRows(strapi.db.connection, checked.rows);
    ctx.body = { added };
  },
}));
