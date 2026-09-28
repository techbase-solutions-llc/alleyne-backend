'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// Signed-in users no longer read listings through the API (TEC-1343 review), so the
// sanitizer would strip the listing from their own favourites. The listing is attached
// here with a fixed set of card fields, and only while the public can see it.
const LISTING_FIELDS = ['slug', 'title', 'transactionType', 'parish', 'bedrooms', 'bathrooms', 'priceMinor', 'nightlyRateMinor'];
const HIDDEN = new Set(['draft', 'suppressed']);
const cardOf = (l) => {
  if (!l || l.publishedAt == null || HIDDEN.has(l.status)) return null;
  const out = { id: l.id };
  for (const k of LISTING_FIELDS) out[k] = l[k] ?? null;
  // The listing's own first photo (TEC-1344: saved cards showed stock photos).
  const ext = Array.isArray(l.externalImages) ? l.externalImages.find((u) => typeof u === 'string' && u.startsWith('http')) : null;
  out.image = ext || l.primaryMedia?.url || null;
  return out;
};

module.exports = createCoreController('api::favorite.favorite', ({ strapi }) => ({
  /**
   * Find favourites — scoped to the authenticated user via entityService
   * to bypass Strapi's content-API sanitizer, which rejects filters on
   * the users-permissions relation when called with a user JWT.
   */
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Fixed order and bounded paging: a caller-chosen sort on the listing relation would
    // reveal the order of hidden listings (second review).
    const { pagination } = ctx.query;
    const pageSize = Math.min(Math.max(parseInt(pagination?.pageSize, 10) || 50, 1), 100);
    const page = Math.max(parseInt(pagination?.page, 10) || 1, 1);

    const [entities, total] = await Promise.all([
      strapi.entityService.findMany('api::favorite.favorite', {
        filters: { user: { id: user.id } },
        // Fixed, not caller-chosen.
        populate: { listing: { fields: [...LISTING_FIELDS, 'status', 'publishedAt', 'externalImages'], populate: { primaryMedia: { fields: ['url'] } } } },
        sort: { createdAt: 'desc' },
        pagination: { page, pageSize },
      }),
      strapi.entityService.count('api::favorite.favorite', {
        filters: { user: { id: user.id } },
      }),
    ]);

    const cards = new Map(entities.map((e) => [e.id, cardOf(e.listing)]));
    const sanitized = await this.sanitizeOutput(entities.map(({ listing, ...rest }) => rest), ctx);
    for (const row of sanitized) row.listing = cards.get(row.id) ?? null;
    return this.transformResponse(sanitized, {
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
    });
  },

  /**
   * Create a favourite — idempotent: returns existing if (user, listing) pair already exists.
   */
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { listing } = ctx.request.body?.data ?? {};
    if (!listing) return ctx.badRequest('listing is required');

    const listingId = Number(typeof listing === 'object' ? listing.id ?? listing : listing);
    if (!Number.isInteger(listingId)) return ctx.badRequest('listing is required');
    // Only a listing the public can see may be saved (second review).
    const target = await strapi.entityService.findOne('api::canonical-listing.canonical-listing', listingId, { fields: ['status', 'publishedAt'] });
    if (!cardOf(target && { ...target, id: listingId })) return ctx.badRequest('This property cannot be saved.');

    // Check for existing favourite
    const existing = await strapi.entityService.findMany('api::favorite.favorite', {
      filters: { user: user.id, listing: listingId },
      pagination: { limit: 1 },
    });

    if (existing.length > 0) {
      // Return the existing record in standard Strapi format
      return this.transformResponse(existing[0]);
    }

    // Use entityService directly to bypass sanitizeInput (which strips the user relation)
    const entity = await strapi.entityService.create('api::favorite.favorite', {
      data: { user: user.id, listing: listingId },
    });
    return this.transformResponse(entity);
  },

  /**
   * Delete a favourite — only the owning user may delete.
   */
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { id } = ctx.params;
    const fav = await strapi.entityService.findOne('api::favorite.favorite', id, {
      populate: ['user'],
    });

    if (!fav) return ctx.notFound();
    if (fav.user?.id !== user.id) return ctx.forbidden('You can only remove your own favourites.');

    return super.delete(ctx);
  },
}));
