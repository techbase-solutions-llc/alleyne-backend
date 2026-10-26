'use strict';

/**
 * Canonical listing lifecycle (TEC-1343).
 *
 * Stamps firstPublicAt (and listedAt when empty) the first time a listing becomes public:
 * published in Strapi and in an available status (see utils/first-public). Runs on every
 * write path: the site dashboard, imports, and the admin panel's Save and Publish. The
 * site's daily saved-search alert emails count a listing as new from that moment.
 *
 * Replaces the hook inherited from Realtlist, which on status=active POSTed the listing's
 * slug to FRONTEND_URL (defaulting to realtlist.com) when INTERNAL_DISPATCH_SECRET was set.
 * That variable was never set here, so nothing was sent; the site now pulls instead.
 */
const { publicPatch, AVAILABLE, barbadosDate } = require('../../../../utils/first-public');
// soldAt (Sold banner period) and privateToken (quiet listing link): TEC-1412.
const { statusPatch } = require('../../../../utils/status-stamps');
// A deleted listing takes its office notes and transactions with it (TEC-1909).
const { officeRecordsToRemove, removeOfficeRecords } = require('../../../../utils/listing-note-cleanup');
// The listing timeline: a listing-history row per status or publish change (TEC-1909).
const { historyChanges, historyRows, changeSourceFor, writeHistory } = require('../../../../utils/listing-history');

const UID = 'api::canonical-listing.canonical-listing';

// Writes the timeline rows after a save. Never throws: a lost history row must not fail
// the listing save, so any failure is logged instead.
async function recordHistory(changes, listingId) {
  try {
    if (!changes || !changes.length) return;
    const source = changeSourceFor(strapi.requestContext?.get?.());
    const rows = historyRows({ changes, listingId, now: new Date().toISOString(), source });
    await writeHistory(strapi.db, rows, strapi.log);
  } catch (err) {
    strapi.log?.error?.(`[listing-history] skipped on listing ${listingId}: ${err.message}`);
  }
}

module.exports = {
  beforeCreate(event) {
    const data = event.params.data || {};
    // An absent publishedAt on create counts as unpublished; if such a listing is in fact
    // public, the site falls back to createdAt, which is the same moment.
    const next = { ...data, status: data.status ?? 'draft', publishedAt: data.publishedAt ?? null };
    const now = new Date().toISOString();
    // create: a new row always gets its own key and sold date (never a clone of the source).
    Object.assign(data, publicPatch({ prev: null, next, now }), statusPatch({ prev: null, next, now, create: true }));
    event.params.data = data;
  },

  async afterCreate(event) {
    const row = event.result || {};
    await recordHistory(historyChanges({ prev: null, next: { status: row.status, publishedAt: row.publishedAt ?? null } }), row.id);
  },

  async beforeUpdate(event) {
    const data = event.params.data || {};
    if (data.status === undefined && data.publishedAt === undefined && !('privateToken' in data) && !('soldAt' in data)) return;
    const prev = await strapi.db.query(UID).findOne({ where: event.params.where, select: ['id', 'status', 'publishedAt', 'listedAt', 'firstPublicAt', 'soldAt', 'privateToken'] });
    if (!prev) return;
    // Worked out before the save, written after it (Strapi passes event.state along).
    event.state.history = { changes: historyChanges({ prev, next: data }), listingId: prev.id };
    const now = new Date().toISOString();
    Object.assign(data, publicPatch({ prev, next: data, now }), statusPatch({ prev, next: data, now }));
    event.params.data = data;
  },

  async afterUpdate(event) {
    const h = event.state?.history;
    if (!h) return;
    await recordHistory(h.changes, event.result?.id ?? h.listingId);
  },

  // Status and its stamps must go through beforeUpdate one row at a time; no bulk path
  // sets them today, and any future one must fail loudly rather than skip the stamps.
  async beforeUpdateMany(event) {
    const data = event.params.data || {};
    if (data.status !== undefined || "privateToken" in data || "soldAt" in data) {
      throw new Error("Listing status can only be changed one listing at a time.");
    }
    // The admin panel's bulk publish and unpublish: note each row's publish time before
    // the save, for the timeline. A failed read only loses the history, never the save.
    if (data.publishedAt === undefined) return;
    try {
      event.state.bulkPrev = await strapi.db.query(UID).findMany({ where: event.params.where || {}, select: ['id', 'publishedAt'] });
    } catch (err) {
      strapi.log?.error?.(`[listing-history] bulk publish not recorded: ${err.message}`);
    }
  },

  // The admin panel's bulk publish uses updateMany, which skips beforeUpdate (second
  // review). Afterwards, stamp any row it made public that has no stamp yet. With the
  // bootstrap backfill, every public row already has one, so this only catches new ones.
  async afterUpdateMany(event) {
    const data = event.params.data || {};
    if (data.status === undefined && data.publishedAt === undefined) return;
    for (const prev of event.state?.bulkPrev || []) {
      await recordHistory(historyChanges({ prev, next: { publishedAt: data.publishedAt } }), prev.id);
    }
    const now = new Date().toISOString();
    const rows = await strapi.db.query(UID).findMany({
      where: { $and: [event.params.where || {}, { firstPublicAt: null, publishedAt: { $notNull: true }, status: { $in: [...AVAILABLE] } }] },
      select: ['id', 'listedAt'],
    });
    for (const r of rows) {
      await strapi.db.query(UID).update({ where: { id: r.id }, data: r.listedAt ? { firstPublicAt: now } : { firstPublicAt: now, listedAt: barbadosDate(now) } });
    }
  },

  // Listing notes and transactions go with their listing (TEC-1909). Found before the
  // delete, while the link still holds; removed after it, so a failed delete loses nothing.
  // Strapi passes the same event.state to the before and after halves.
  async beforeDelete(event) {
    event.state.office = await officeRecordsToRemove(strapi.db, event.params.where);
  },
  async afterDelete(event) {
    await removeOfficeRecords(strapi.db, event.state.office);
  },
  async beforeDeleteMany(event) {
    event.state.office = await officeRecordsToRemove(strapi.db, event.params.where);
  },
  async afterDeleteMany(event) {
    await removeOfficeRecords(strapi.db, event.state.office);
  },
};
