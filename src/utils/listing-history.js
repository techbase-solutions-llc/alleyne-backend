'use strict';
// The listing timeline (Orna, 23 Oct 2026; TEC-1909). The listing's lifecycle writes a
// listing-history row for every change of status or publishing, so the back office can show
// when a listing was listed, went public, went under offer, sold and so on. A failed write is
// logged and never fails the listing save.

const HISTORY = 'api::listing-history.listing-history';
const FIELDS = ['status', 'publishedAt'];

/** A stored or incoming publish time as an ISO string, so a Date and a string compare. */
function moment(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

const value = (field, v) => (field === 'publishedAt' ? moment(v) : v ?? null);

/**
 * prev: the stored row (null on create). next: the incoming data, where an absent key means
 * "unchanged" (on create, the stored result). Returns one change per field that moved.
 */
function historyChanges({ prev, next }) {
  const before = prev || {};
  const out = [];
  for (const field of FIELDS) {
    if (!next || next[field] === undefined) continue;
    const was = value(field, before[field]);
    const now = value(field, next[field]);
    if (was === now) continue;
    out.push({ changedField: field, previousValueJson: was, nextValueJson: now });
  }
  return out;
}

/** The rows to write for those changes. */
function historyRows({ changes, listingId, now, source }) {
  if (listingId === undefined || listingId === null) return [];
  return (changes || []).map((c) => ({ listing: listingId, ...c, changeSource: source, changedAt: now }));
}

/**
 * Who made the change, from the request that made it: the admin panel, an import, or the
 * website (its server token, used by the office's editor). No request means a scheduled or
 * start-up job.
 */
function changeSourceFor(ctx) {
  if (!ctx) return 'system';
  if (ctx.state?.auth?.strategy?.name === 'admin') return 'admin';
  if (/\/source-connections\//.test(ctx.request?.path || '')) return 'sync';
  return 'agent';
}

/** Writes the rows one by one; logs and skips any that fail. Returns how many were written. */
async function writeHistory(db, rows, log) {
  let written = 0;
  for (const row of rows || []) {
    try {
      await db.query(HISTORY).create({ data: row });
      written++;
    } catch (err) {
      log?.error?.(`[listing-history] could not record ${row.changedField} on listing ${row.listing}: ${err.message}`);
    }
  }
  return written;
}

module.exports = { historyChanges, historyRows, changeSourceFor, writeHistory };
