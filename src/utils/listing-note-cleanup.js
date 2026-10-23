'use strict';
// A deleted listing takes its office notes with it (session 4 review, 23 Oct 2026; TEC-1909).
// The note's link points one way, at the listing, so a listing delete only empties the link
// and the notes would stay, shown nowhere. The listing's lifecycle finds the notes before the
// delete (afterwards the link is gone) and removes them once the listing has gone, so a failed
// delete loses nothing.

const LISTING = 'api::canonical-listing.canonical-listing';
const NOTE = 'api::listing-note.listing-note';

/** The ids of the notes on every listing the delete's `where` matches. */
async function notesToRemove(db, where) {
  const listings = await db.query(LISTING).findMany({ where, select: ['id'] });
  const ids = listings.map((l) => l.id);
  if (!ids.length) return [];
  const notes = await db.query(NOTE).findMany({ where: { listing: { id: { $in: ids } } }, select: ['id'] });
  return notes.map((n) => n.id);
}

/** Deletes those notes; returns how many went. */
async function removeNotes(db, ids) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const res = await db.query(NOTE).deleteMany({ where: { id: { $in: ids } } });
  return res?.count ?? ids.length;
}

module.exports = { notesToRemove, removeNotes };
