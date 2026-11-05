'use strict';
// One client account's saved properties and saved searches for the office's client page (client
// accounts plan, 5 Nov 2026, section 2: when each property was saved; every search with its
// alert on or off, and the last alert sent). GET /api/client-saved/:userId gives them to the
// website's full-access server token and to nothing else, exactly as the consent record: no role
// holds the route (src/utils/role-permissions.js) and the route uses the consent endpoint's
// server-token-only policy, so a JWT of any role, the client's own included, gets 403.
const { parseUserId } = require('./client-consent');
const { searchLimit } = require('./saved-search-input');

// Bounds on one answer. A person keeps up to 20 searches and a team member 200; saved properties
// have no limit of their own, so the newest 1000 are given.
const SAVED_MAX = 1000;
const SEARCHES_MAX = searchLimit(true);

const FAVOURITE_SELECT = ['id', 'createdAt', 'notifiedPriceMinor', 'notifiedStatus'];
const SEARCH_SELECT = ['id', 'name', 'alertEnabled', 'lastAlertedAt', 'createdAt', 'clientName', 'filtersJson'];

/** A whole number of minor units from the stored big integer (a string on some databases). */
function minorOf(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

/** One saved property: when it was saved, which listing (null once the listing is deleted) and
    the price and status the saved-property alerts last told the client (null before any). */
function savedItem(row) {
  const l = row?.listing;
  const priceMinor = minorOf(row?.notifiedPriceMinor);
  const status = typeof row?.notifiedStatus === 'string' && row.notifiedStatus ? row.notifiedStatus : null;
  return {
    id: row.id,
    createdAt: row.createdAt ?? null,
    listing: l && l.id != null ? { id: l.id, title: l.title ?? null, slug: l.slug ?? null } : null,
    lastNotifiedChange: priceMinor === null && status === null ? null : { priceMinor, status },
  };
}

/** One saved search, alerts on or off. The summary is the one the client saw when saving it;
    the query, the private client note and the owner are left out. */
function searchItem(row) {
  const summary = row?.filtersJson && typeof row.filtersJson.summary === 'string' ? row.filtersJson.summary : '';
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    alertEnabled: Boolean(row.alertEnabled),
    lastAlertedAt: row.lastAlertedAt ?? null,
    createdAt: row.createdAt ?? null,
    clientName: row.clientName ?? null,
    summary,
  };
}

const ownedBy = (id) => (row) => row?.user?.id === id;

/** One account's saved things, newest first, or null when the id is malformed or has no account.
    Rows come back with their owner's id and any other account's row is dropped, whatever the
    query returned. */
async function readClientSaved(db, rawId) {
  const id = parseUserId(rawId);
  if (!id) return null;
  const user = await db.query('plugin::users-permissions.user').findOne({ where: { id }, select: ['id'] });
  if (!user) return null;
  const order = [{ createdAt: 'desc' }, { id: 'desc' }];
  const [favourites, searches] = await Promise.all([
    db.query('api::favorite.favorite').findMany({
      where: { user: { id } },
      select: FAVOURITE_SELECT,
      populate: { user: { select: ['id'] }, listing: { select: ['id', 'title', 'slug'] } },
      orderBy: order,
      limit: SAVED_MAX,
    }),
    db.query('api::saved-search.saved-search').findMany({
      where: { user: { id } },
      select: SEARCH_SELECT,
      populate: { user: { select: ['id'] } },
      orderBy: order,
      limit: SEARCHES_MAX,
    }),
  ]);
  return {
    saved: (favourites ?? []).filter(ownedBy(id)).map(savedItem),
    searches: (searches ?? []).filter(ownedBy(id)).map(searchItem),
  };
}

module.exports = { SAVED_MAX, SEARCHES_MAX, savedItem, searchItem, readClientSaved };
