'use strict';
// The website's daily alert run reads every saved property with its server token (TEC-1909,
// plan D3): owner id, listing id and the price and status the owner was last told about, so
// each change is emailed once. Nothing else leaves: no names, emails or listing details.

/** A request made with an API token (the website's server token), not by a signed-in user. */
const isServerToken = (ctx) => ctx?.state?.auth?.strategy?.name === 'api-token';

/** One page in the Strapi 4 response shape the website reads. */
function tokenListPage(rows, { page, pageSize, total }) {
  return {
    data: rows.map((r) => ({
      id: r.id,
      attributes: {
        notifiedPriceMinor: r.notifiedPriceMinor ?? null,
        notifiedStatus: r.notifiedStatus ?? null,
        user: { data: r.user?.id ? { id: r.user.id } : null },
        listing: { data: r.listing?.id ? { id: r.listing.id } : null },
      },
    })),
    meta: { pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total } },
  };
}

module.exports = { isServerToken, tokenListPage };
