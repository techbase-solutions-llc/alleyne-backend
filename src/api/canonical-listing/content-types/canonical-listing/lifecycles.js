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
const { publicPatch, AVAILABLE, barbadosDate } = require('../../../../utils/first-public');
// soldAt (Sold banner period) and privateToken (quiet listing link): TEC-1412.
const { statusPatch } = require('../../../../utils/status-stamps');

const UID = 'api::canonical-listing.canonical-listing';

module.exports = {
  beforeCreate(event) {
    const data = event.params.data || {};
    // An absent publishedAt on create counts as unpublished; if such a listing is in fact
    // public, the site falls back to createdAt, which is the same moment.
    const next = { ...data, status: data.status ?? 'draft', publishedAt: data.publishedAt ?? null };
    const now = new Date().toISOString();
    Object.assign(data, publicPatch({ prev: null, next, now }), statusPatch({ prev: null, next, now }));
    event.params.data = data;
  },

  async beforeUpdate(event) {
    const data = event.params.data || {};
    if (data.status === undefined && data.publishedAt === undefined && !('privateToken' in data) && !('soldAt' in data)) return;
    const prev = await strapi.db.query(UID).findOne({ where: event.params.where, select: ['status', 'publishedAt', 'listedAt', 'firstPublicAt', 'soldAt', 'privateToken'] });
    if (!prev) return;
    const now = new Date().toISOString();
    Object.assign(data, publicPatch({ prev, next: data, now }), statusPatch({ prev, next: data, now }));
    event.params.data = data;
  },

  // The admin panel's bulk publish uses updateMany, which skips beforeUpdate (second
  // review). Afterwards, stamp any row it made public that has no stamp yet. With the
  // bootstrap backfill, every public row already has one, so this only catches new ones.
  async afterUpdateMany(event) {
    const data = event.params.data || {};
    if (data.status === undefined && data.publishedAt === undefined) return;
    const now = new Date().toISOString();
    const rows = await strapi.db.query(UID).findMany({
      where: { $and: [event.params.where || {}, { firstPublicAt: null, publishedAt: { $notNull: true }, status: { $in: [...AVAILABLE] } }] },
      select: ['id', 'listedAt'],
    });
    for (const r of rows) {
      await strapi.db.query(UID).update({ where: { id: r.id }, data: r.listedAt ? { firstPublicAt: now } : { firstPublicAt: now, listedAt: barbadosDate(now) } });
    }
  },
};
