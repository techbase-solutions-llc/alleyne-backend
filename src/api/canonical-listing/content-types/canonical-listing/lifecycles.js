'use strict';

/**
 * Canonical listing lifecycle (TEC-1343).
 *
 * Stamps firstPublicAt (and listedAt when empty) the first time a listing becomes public:
 * published in Strapi and in an available status (see utils/first-public). Runs on every
 * write path: the site dashboard, imports, and the admin panel's Save and Publish. The
 * site's daily saved-search alert emails count a listing as new from that moment.
 *
 * Replaces the hook inherited from Realtlist, which on status=active POSTed the listing's
 * slug to FRONTEND_URL (defaulting to realtlist.com) when INTERNAL_DISPATCH_SECRET was set.
 * That variable was never set here, so nothing was sent; the site now pulls instead.
 */
const { publicPatch } = require('../../../../utils/first-public');

const UID = 'api::canonical-listing.canonical-listing';

module.exports = {
  beforeCreate(event) {
    const data = event.params.data || {};
    // An absent publishedAt on create counts as unpublished; if such a listing is in fact
    // public, the site falls back to createdAt, which is the same moment.
    const next = { ...data, status: data.status ?? 'draft', publishedAt: data.publishedAt ?? null };
    Object.assign(data, publicPatch({ prev: null, next, now: new Date().toISOString() }));
    event.params.data = data;
  },

  async beforeUpdate(event) {
    const data = event.params.data || {};
    if (data.status === undefined && data.publishedAt === undefined) return;
    const prev = await strapi.db.query(UID).findOne({ where: event.params.where, select: ['status', 'publishedAt', 'listedAt', 'firstPublicAt'] });
    if (!prev) return;
    Object.assign(data, publicPatch({ prev, next: data, now: new Date().toISOString() }));
    event.params.data = data;
  },
};
