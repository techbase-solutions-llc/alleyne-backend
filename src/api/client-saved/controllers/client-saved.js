'use strict';
const { serverTokenOnly } = require('../../../utils/client-consent');
const { readClientSaved } = require('../../../utils/client-saved');

module.exports = {
  /** GET /api/client-saved/:userId: { saved: [{ id, createdAt, listing, lastNotifiedChange }],
      searches: [{ id, name, alertEnabled, lastAlertedAt, createdAt, clientName, summary }] }, or
      404 when there is no such account. The route's policy already refuses anything but the
      server token; the check is repeated here so the controller is safe on its own. */
  async findOne(ctx) {
    if (!serverTokenOnly(ctx)) return ctx.forbidden();
    const saved = await readClientSaved(strapi.db, ctx.params.userId);
    if (!saved) return ctx.notFound();
    ctx.body = saved;
  },
};
