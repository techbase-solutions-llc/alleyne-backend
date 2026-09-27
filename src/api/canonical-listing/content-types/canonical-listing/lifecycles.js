'use strict';

/**
 * Canonical listing lifecycle (TEC-1343).
 *
 * Stamps firstPublicAt (and listedAt when empty) the first time a listing goes public, on
 * every write path: the site dashboard, imports and the admin panel. The site's daily
 * saved-search alert emails count a listing as new from that moment.
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
    Object.assign(data, publicPatch({ prevStatus: null, nextStatus: data.status ?? 'draft', prev: {}, now: new Date().toISOString(), incoming: data }));
    event.params.data = data;
  },

  async beforeUpdate(event) {
    const data = event.params.data || {};
    if (data.status === undefined) return;
    const prev = await strapi.db.query(UID).findOne({ where: event.params.where, select: ['status', 'listedAt', 'firstPublicAt'] });
    if (!prev) return;
    Object.assign(data, publicPatch({ prevStatus: prev.status, nextStatus: data.status, prev, now: new Date().toISOString(), incoming: data }));
    event.params.data = data;
  },
};
