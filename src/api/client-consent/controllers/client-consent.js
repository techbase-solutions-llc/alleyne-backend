'use strict';
const { serverTokenOnly, readConsent } = require('../../../utils/client-consent');

module.exports = {
  /** GET /api/client-consents/:userId: { marketingOptIn, marketingOptInAt, marketingConsentText,
      marketingConsentVersion, marketingConsentSource, marketingOptOutAt, marketingOptOutSource },
      or 404 when there is no such account. The route's policy already refuses anything but the
      server token; the check is repeated here so the controller is safe on its own. */
  async findOne(ctx) {
    if (!serverTokenOnly(ctx)) return ctx.forbidden();
    const consent = await readConsent(strapi.db, ctx.params.userId);
    if (!consent) return ctx.notFound();
    ctx.body = consent;
  },
};
