// src/api/agency-membership/controllers/invite.js
'use strict';
const { newInviteCode, tokenOnly } = require('../../../utils/invite-code');

module.exports = {
  /** Issue (or clear) the set-password code for a team member the site has just invited.
      The site's server token only: it is never granted to a role. */
  async code(ctx) {
    if (!tokenOnly(ctx)) return ctx.forbidden();
    const userId = Number(ctx.request.body?.userId);
    if (!Number.isInteger(userId) || userId <= 0) return ctx.badRequest('userId is required');
    const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
    if (!user) return ctx.notFound();
    const code = ctx.request.body?.clear ? null : newInviteCode();
    await strapi.query('plugin::users-permissions.user').update({ where: { id: userId }, data: { resetPasswordToken: code } });
    ctx.body = { code };
  },
};
