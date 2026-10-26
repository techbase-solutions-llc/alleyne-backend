'use strict';
// A deleted account takes its saved properties and saved searches with it (plan A5, 26 Oct
// 2026; TEC-1909). Both point one way, at the user, so a user delete only empties the link and
// the rows would stay, belonging to nobody. As with a listing's notes (listing-note-cleanup.js),
// the rows are found before the delete, while the link holds, and removed once the account has
// gone, so a failed delete loses nothing. Used by the user lifecycle in utils/auth-overrides.js.

const USER = 'plugin::users-permissions.user';
const FAVOURITE = 'api::favorite.favorite';
const SAVED_SEARCH = 'api::saved-search.saved-search';

async function linkedIds(db, uid, userIds) {
  if (!userIds.length) return [];
  const rows = await db.query(uid).findMany({ where: { user: { id: { $in: userIds } } }, select: ['id'] });
  return rows.map((r) => r.id);
}

async function removeIds(db, uid, ids) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const res = await db.query(uid).deleteMany({ where: { id: { $in: ids } } });
  return res?.count ?? ids.length;
}

/** The ids of the favourites and saved searches of every account the delete's `where` matches. */
async function savedItemsToRemove(db, where) {
  const users = await db.query(USER).findMany({ where, select: ['id'] });
  const ids = users.map((u) => u.id);
  return { favourites: await linkedIds(db, FAVOURITE, ids), savedSearches: await linkedIds(db, SAVED_SEARCH, ids) };
}

/** Deletes those rows; returns how many of each went. */
async function removeSavedItems(db, found) {
  return {
    favourites: await removeIds(db, FAVOURITE, found?.favourites),
    savedSearches: await removeIds(db, SAVED_SEARCH, found?.savedSearches),
  };
}

module.exports = { savedItemsToRemove, removeSavedItems };
