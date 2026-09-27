'use strict';

// When a listing first goes public (TEC-1343). Saved-search alert emails on the site count
// a listing as new from this moment. listedAt is a date only, so firstPublicAt carries
// the time; listedAt is filled in too when it is empty, for the "New" badge.
//
// Public means both: published in Strapi (publishedAt set: the public API only returns
// published entries) and in an available status. A listing that first appears as sold,
// rented or archived is not a new listing (review), so those do not stamp.
const AVAILABLE = new Set(['active', 'ready', 'under_offer']);

/** Barbados calendar date (UTC-4 all year; no daylight saving). */
function barbadosDate(iso) {
  return new Date(Date.parse(iso) - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Fields to add to a save. prev is the stored row (null on create); next is the incoming
 * data, where an absent key means "unchanged". Returns {} to leave everything alone.
 */
function publicPatch({ prev, next, now }) {
  const before = prev || {};
  if (next.firstPublicAt || before.firstPublicAt) return {};
  const status = next.status !== undefined ? next.status : before.status;
  const published = next.publishedAt !== undefined ? next.publishedAt : before.publishedAt;
  const wasPublic = !!prev && AVAILABLE.has(before.status) && before.publishedAt != null;
  const isPublic = AVAILABLE.has(status) && published != null;
  if (!isPublic || wasPublic) return {};
  return before.listedAt || next.listedAt ? { firstPublicAt: now } : { firstPublicAt: now, listedAt: barbadosDate(now) };
}

module.exports = { publicPatch, barbadosDate, AVAILABLE };
