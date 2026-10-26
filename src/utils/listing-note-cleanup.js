'use strict';
// A deleted listing takes its office notes with it (session 4 review, 23 Oct 2026; TEC-1909).
// The note's link points one way, at the listing, so a listing delete only empties the link
// and the notes would stay, shown nowhere. The listing's lifecycle finds the notes before the
// delete (afterwards the link is gone) and removes them once the listing has gone, so a failed
// delete loses nothing. Listing transactions (Orna, 23 Oct 2026) are linked the same way and go
// the same way.

const LISTING = 'api::canonical-listing.canonical-listing';
const NOTE = 'api::listing-note.listing-note';
const TRANSACTION = 'api::listing-transaction.listing-transaction';

async function listingIds(db, where) {
  const listings = await db.query(LISTING).findMany({ where, select: ['id'] });
  return listings.map((l) => l.id);
}

async function linkedIds(db, uid, ids) {
  if (!ids.length) return [];
  const rows = await db.query(uid).findMany({ where: { listing: { id: { $in: ids } } }, select: ['id'] });
  return rows.map((r) => r.id);
}

async function removeIds(db, uid, ids) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const res = await db.query(uid).deleteMany({ where: { id: { $in: ids } } });
  return res?.count ?? ids.length;
}

/** The ids of the notes on every listing the delete's `where` matches. */
async function notesToRemove(db, where) {
  return linkedIds(db, NOTE, await listingIds(db, where));
}

/** Deletes those notes; returns how many went. */
async function removeNotes(db, ids) {
  return removeIds(db, NOTE, ids);
}

/** The ids of the notes and transactions on every listing the delete's `where` matches. */
async function officeRecordsToRemove(db, where) {
  const ids = await listingIds(db, where);
  return { notes: await linkedIds(db, NOTE, ids), transactions: await linkedIds(db, TRANSACTION, ids) };
}

/** Deletes those records; returns how many of each went. */
async function removeOfficeRecords(db, found) {
  return {
    notes: await removeIds(db, NOTE, found?.notes),
    transactions: await removeIds(db, TRANSACTION, found?.transactions),
  };
}

module.exports = { notesToRemove, removeNotes, officeRecordsToRemove, removeOfficeRecords };
