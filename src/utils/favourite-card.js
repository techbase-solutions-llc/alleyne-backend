'use strict';
// The card a saved property shows, and what is left when its listing is off the website.
// Signed-in users do not read listings through the API (TEC-1343 review), so the favourites
// controller attaches a fixed set of card fields, and only while the public can see the listing.

const LISTING_FIELDS = ['slug', 'title', 'transactionType', 'parish', 'bedrooms', 'bathrooms', 'priceMinor', 'nightlyRateMinor'];
// Quiet listings are shared only by their private link, and archived ones are off the site:
// neither can be saved or shown as a saved card (TEC-1412).
const HIDDEN = new Set(['draft', 'suppressed', 'quiet', 'archived']);

const isPublic = (l) => !!l && l.publishedAt != null && !HIDDEN.has(l.status);

/** The card, or null when the public cannot see the listing. */
function cardOf(l) {
  if (!isPublic(l)) return null;
  const out = { id: l.id };
  for (const k of LISTING_FIELDS) out[k] = l[k] ?? null;
  // The listing's own first photo (TEC-1344: saved cards showed stock photos).
  const ext = Array.isArray(l.externalImages) ? l.externalImages.find((u) => typeof u === 'string' && u.startsWith('http')) : null;
  out.image = ext || l.primaryMedia?.url || null;
  return out;
}

/** The name of a saved listing that has left the website, so the person can tell which one it
    was (review, 27 Oct). Null while it is public, and for a draft, which was never public. */
function goneTitleOf(l) {
  if (!l || isPublic(l) || l.status === 'draft') return null;
  return typeof l.title === 'string' && l.title.trim() ? l.title.trim() : null;
}

module.exports = { LISTING_FIELDS, cardOf, goneTitleOf };
