// src/api/agency-membership/controllers/invite.js
'use strict';
const { newInviteCode, tokenOnly, codeStatus, unusedInvitation } = require('../../../utils/invite-code');

/** The user the site names, or null when the body does not name one. */
const userOf = async (ctx) => {
  const userId = Number(ctx.request.body?.userId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
};

module.exports = {
  /** Issue (or clear) the set-password code for a team member the site has just invited.
      The site's server token only: it is never granted to a role. */
  async code(ctx) {
    if (!tokenOnly(ctx)) return ctx.forbidden();
    const userId = Number(ctx.request.body?.userId);
    if (!Number.isInteger(userId) || userId <= 0) return ctx.badRequest('userId is required');
    const user = await userOf(ctx);
    if (!user) return ctx.notFound();
    const code = ctx.request.body?.clear ? null : newInviteCode();
    await strapi.query('plugin::users-permissions.user').update({ where: { id: userId }, data: { resetPasswordToken: code } });
    ctx.body = { code };
  },

  /** Whether the user still has an unused set-password code, and whether the code the site
      sends is that one (review, 8 Oct 2026): an invitation link from before a resend then
      shows as dead at once. `unused` tells removing an invitation whether the account was
      ever used (utils/invite-code.js unusedInvitation); the site cannot count another
      user's favourites itself. The code itself never leaves the backend. Server token only. */
  async status(ctx) {
    if (!tokenOnly(ctx)) return ctx.forbidden();
    const user = await userOf(ctx);
    if (!user) return ctx.notFound();
    const status = codeStatus(user.resetPasswordToken, ctx.request.body?.code);
    const byUser = { filters: { user: { id: user.id } } };
    const [favourites, savedSearches] = status.invitation
      ? await Promise.all([
          strapi.entityService.count('api::favorite.favorite', byUser),
          strapi.entityService.count('api::saved-search.saved-search', byUser),
        ])
      : [NaN, NaN];
    ctx.body = { ...status, unused: unusedInvitation(status, { favourites, savedSearches }) };
  },
};
