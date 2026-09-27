'use strict';

// When a listing first goes public (TEC-1343). Saved-search alert emails on the site count
// a listing as new from this moment. listedAt is a date only, so firstPublicAt carries
// the time; listedAt is filled in too when it is empty, for the "New" badge.

// The public site hides these statuses (site src/lib/strapi.ts PUBLIC).
const HIDDEN = new Set(['draft', 'suppressed']);
const isPublic = (s) => !!s && !HIDDEN.has(s);

/**
 * Fields to add to a save. prevStatus is null on create; nextStatus is undefined when the
 * save does not change the status. Returns {} to leave everything alone.
 */
function publicPatch({ prevStatus, nextStatus, prev = {}, now, incoming = {} }) {
  if (incoming.firstPublicAt || prev.firstPublicAt) return {};
  if (!isPublic(nextStatus) || isPublic(prevStatus)) return {};
  return prev.listedAt || incoming.listedAt ? { firstPublicAt: now } : { firstPublicAt: now, listedAt: now.slice(0, 10) };
}

module.exports = { publicPatch, isPublic };
