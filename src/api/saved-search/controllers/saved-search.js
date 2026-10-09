'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// The site's server (full-access API token) runs the daily alert emails (TEC-1343): it may
// list alert-enabled searches with their owner's email, and stamp lastAlertedAt. Nothing else.
// Full-access tokens only: a read-only or custom token must not reach owners' emails (review).
const isApiToken = (ctx) =>
  ctx.state.auth?.strategy?.name === 'api-token' && ctx.state.auth?.credentials?.type === 'full-access';

// Abuse limits (TEC-1343 review): sign-up needs no email check, so an account made with
// someone else's address could otherwise flood them with alerts. Team members may keep more
// (searchLimit): they save searches for their clients (8 Oct 2026 meeting).
const { clean, userIdOf, clientLabel, searchLimit } = require('../../../utils/saved-search-input');

// A client label (8 Oct 2026 meeting) is kept only for active team members: the alert run
// puts it in an email's subject, so an ordinary account must not be able to set one.
const isTeamMember = async (strapi, userId) =>
  (await strapi.entityService.count('api::agency-membership.agency-membership', { filters: { user: { id: userId }, status: 'active' } })) > 0;

module.exports = createCoreController('api::saved-search.saved-search', ({ strapi }) => ({
  /**
   * Turn off every alert of one account (review, 8 Oct 2026): the signed "stop these
   * emails" link in alert emails, which works without signing in. The site checks the
   * link's signature and calls this with its full-access token; no role is granted it.
   * The searches stay; only their alert switches go off.
   */
  async alertsOff(ctx) {
    if (ctx.state.user || !isApiToken(ctx)) return ctx.forbidden();
    const userId = userIdOf(ctx.request.body);
    if (!userId) return ctx.badRequest('userId is required');
    const rows = await strapi.entityService.findMany('api::saved-search.saved-search', {
      filters: { user: { id: userId }, alertEnabled: true },
      fields: ['id'],
      limit: searchLimit(true),
    });
    for (const r of rows) await strapi.entityService.update('api::saved-search.saved-search', r.id, { data: { alertEnabled: false } });
    ctx.body = { stopped: rows.length };
  },

  /**
   * Find saved searches — scoped to the authenticated user via entityService
   * to bypass Strapi's content-API sanitizer, which rejects filters on
   * the users-permissions relation when called with a user JWT.
   */
  async find(ctx) {
    if (!ctx.state.user && isApiToken(ctx)) {
      const pageSize = Math.min(Number(ctx.query.pagination?.pageSize ?? 100), 100);
      const page = Number(ctx.query.pagination?.page ?? 1);
      const where = { alertEnabled: true };
      const [entities, total] = await Promise.all([
        strapi.entityService.findMany('api::saved-search.saved-search', {
          filters: where,
          fields: ['name', 'filtersJson', 'alertEnabled', 'lastAlertedAt', 'clientName', 'clientNote'],
          populate: { user: { fields: ['email', 'username', 'blocked', 'confirmed'] } },
          sort: { id: 'asc' },
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),
        strapi.entityService.count('api::saved-search.saved-search', { filters: where }),
      ]);
      return this.transformResponse(entities, { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } });
    }

    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { sort, pagination } = ctx.query;
    const pageSize = Math.min(Math.max(parseInt(pagination?.pageSize, 10) || 100, 1), 100);
    const page = Math.max(parseInt(pagination?.page, 10) || 1, 1);

    const [entities, total] = await Promise.all([
      strapi.entityService.findMany('api::saved-search.saved-search', {
        filters: { user: { id: user.id } },
        // No caller-chosen populate: a user's own rows need no relations.
        populate: {},
        sort: sort ?? { createdAt: 'desc' },
        pagination: { page, pageSize },
      }),
      strapi.entityService.count('api::saved-search.saved-search', {
        filters: { user: { id: user.id } },
      }),
    ]);

    const sanitized = await this.sanitizeOutput(entities, ctx);
    return this.transformResponse(sanitized, {
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
    });
  },

  /**
   * Create a saved search — forces user to the authenticated user.
   * Uses entityService.create directly to bypass sanitizeInput, which strips
   * the `user` relation field for Authenticated role requests.
   */
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const data = clean(ctx.request.body?.data ?? {});
    if (!data.name || !data.filtersJson) return ctx.badRequest('name and filtersJson.query are required');
    const team = await isTeamMember(strapi, user.id);
    if (team) Object.assign(data, clientLabel(ctx.request.body?.data));
    const max = searchLimit(team);
    const count = await strapi.entityService.count('api::saved-search.saved-search', { filters: { user: { id: user.id } } });
    if (count >= max) return ctx.badRequest(`You can keep up to ${max} saved searches.`);

    try {
      const entity = await strapi.entityService.create('api::saved-search.saved-search', {
        // lastAlertedAt is never taken from a user: the alert run sets it.
        data: { ...data, alertEnabled: data.alertEnabled ?? false, user: user.id },
      });
      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    } catch (err) {
      return ctx.internalServerError(err.message);
    }
  },

  /**
   * Delete a saved search — only the owning user may delete. Rows without an owner are
   * left to the admin (they were deletable by any signed-in user; TEC-1343 review).
   */
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const saved = await strapi.entityService.findOne('api::saved-search.saved-search', id, {
      populate: ['user'],
    });

    if (!saved) return ctx.notFound();
    if (saved.user?.id !== user.id) {
      return ctx.forbidden('You can only delete your own saved searches.');
    }

    return super.delete(ctx);
  },

  /**
   * Update a saved search — only the owning user may update. The server's API token may
   * only record when an alert was last sent.
   */
  async update(ctx) {
    if (!ctx.state.user && isApiToken(ctx)) {
      const at = ctx.request.body?.data?.lastAlertedAt;
      if (!at || Number.isNaN(Date.parse(at))) return ctx.badRequest('lastAlertedAt is required');
      const found = await strapi.entityService.findOne('api::saved-search.saved-search', ctx.params.id);
      if (!found) return ctx.notFound();
      const entity = await strapi.entityService.update('api::saved-search.saved-search', found.id, { data: { lastAlertedAt: at } });
      return this.transformResponse({ id: entity.id, lastAlertedAt: entity.lastAlertedAt });
    }

    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const saved = await strapi.entityService.findOne('api::saved-search.saved-search', id, {
      populate: ['user'],
    });

    if (!saved) return ctx.notFound();
    if (saved.user?.id !== user.id) {
      return ctx.forbidden('You can only update your own saved searches.');
    }

    // Only name, filters and the alert switch (and a team member's client label). Turning
    // alerts back on starts afresh, so the next run sets a new starting point instead of
    // emailing everything since the last alert (review); a user can never set lastAlertedAt
    // themselves.
    const label = clientLabel(ctx.request.body?.data);
    const data = { ...clean(ctx.request.body?.data ?? {}), ...(Object.keys(label).length && (await isTeamMember(strapi, user.id)) ? label : {}) };
    if (data.alertEnabled === true && !saved.alertEnabled) data.lastAlertedAt = null;
    const entity = await strapi.entityService.update('api::saved-search.saved-search', saved.id, { data });
    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },
}));
