// src/api/page-view-day/controllers/page-view-day.js
'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
const { isServerToken } = require('../../../utils/favourite-token-list');
const { checkRows, addRows } = require('../../../utils/page-view-days');

module.exports = createCoreController('api::page-view-day.page-view-day', () => ({
  /** Add one drain delivery's counts: { batch, rows: [{ day, dimension, value, views, tokens }] },
      at most 2,000 rows. Views are added, visitors grow by the tokens not seen before that day,
      and a batch key already added answers { repeat: true } and adds nothing, so a redelivery
      is safe. The website's full-access server token only: no role holds it. */
  async add(ctx) {
    if (ctx.state.user || !isServerToken(ctx)) return ctx.forbidden();
    const checked = checkRows(ctx.request.body);
    if (checked.error) return ctx.badRequest(checked.error);
    ctx.body = await addRows(strapi.db.connection, checked);
  },
}));
