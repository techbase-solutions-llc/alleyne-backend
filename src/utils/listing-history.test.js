'use strict';
// Run: npm test
// The listing timeline (Orna, 23 Oct 2026; TEC-1909): every status or publish change of a
// listing is written to listing-history by the listing's lifecycle.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { historyChanges, historyRows, changeSourceFor, writeHistory } = require('./listing-history');

test('a status change is one row, from the old status to the new', () => {
  assert.deepEqual(historyChanges({ prev: { status: 'active', publishedAt: null }, next: { status: 'under_offer' } }), [
    { changedField: 'status', previousValueJson: 'active', nextValueJson: 'under_offer' },
  ]);
});

test('publishing and unpublishing are rows; times compare as moments, not as text', () => {
  const at = '2026-10-26T14:00:00.000Z';
  assert.deepEqual(historyChanges({ prev: { status: 'active', publishedAt: null }, next: { publishedAt: at } }), [
    { changedField: 'publishedAt', previousValueJson: null, nextValueJson: at },
  ]);
  assert.deepEqual(historyChanges({ prev: { status: 'active', publishedAt: new Date(at) }, next: { publishedAt: null } }), [
    { changedField: 'publishedAt', previousValueJson: at, nextValueJson: null },
  ]);
  // The same moment as a Date, a string or a number is no change.
  assert.deepEqual(historyChanges({ prev: { publishedAt: new Date(at) }, next: { publishedAt: at } }), []);
  assert.deepEqual(historyChanges({ prev: { publishedAt: Date.parse(at) }, next: { publishedAt: new Date(at) } }), []);
});

test('a save that leaves status and publishing alone writes nothing', () => {
  const prev = { status: 'active', publishedAt: '2026-10-01T10:00:00.000Z' };
  assert.deepEqual(historyChanges({ prev, next: {} }), []);
  assert.deepEqual(historyChanges({ prev, next: { title: 'New title' } }), []);
  assert.deepEqual(historyChanges({ prev, next: { status: 'active', publishedAt: '2026-10-01T10:00:00.000Z' } }), []);
});

test('both changing at once is two rows, status first', () => {
  const rows = historyChanges({ prev: { status: 'draft', publishedAt: null }, next: { status: 'active', publishedAt: '2026-10-26T12:00:00.000Z' } });
  assert.deepEqual(rows.map((r) => r.changedField), ['status', 'publishedAt']);
});

test('a new listing records its first status, and its publishing only when published', () => {
  assert.deepEqual(historyChanges({ prev: null, next: { status: 'draft', publishedAt: null } }), [
    { changedField: 'status', previousValueJson: null, nextValueJson: 'draft' },
  ]);
  const at = '2026-10-26T12:00:00.000Z';
  assert.deepEqual(historyChanges({ prev: null, next: { status: 'active', publishedAt: at } }), [
    { changedField: 'status', previousValueJson: null, nextValueJson: 'active' },
    { changedField: 'publishedAt', previousValueJson: null, nextValueJson: at },
  ]);
});

test('rows carry the listing, the source and the moment', () => {
  const changes = [{ changedField: 'status', previousValueJson: 'active', nextValueJson: 'sold' }];
  assert.deepEqual(historyRows({ changes, listingId: 7, now: '2026-10-26T12:00:00.000Z', source: 'admin' }), [
    { listing: 7, changedField: 'status', previousValueJson: 'active', nextValueJson: 'sold', changeSource: 'admin', changedAt: '2026-10-26T12:00:00.000Z' },
  ]);
  assert.deepEqual(historyRows({ changes: [], listingId: 7, now: 'x', source: 'agent' }), []);
  assert.deepEqual(historyRows({ changes, listingId: undefined, now: 'x', source: 'agent' }), [], 'no listing, no row');
});

test('the source is admin for the admin panel, sync for imports, system with no request, agent otherwise', () => {
  assert.equal(changeSourceFor({ state: { auth: { strategy: { name: 'admin' } } }, request: { path: '/content-manager/collection-types/x' } }), 'admin');
  assert.equal(changeSourceFor({ state: { auth: { strategy: { name: 'api-token' } } }, request: { path: '/api/source-connections/3/trigger-sync' } }), 'sync');
  assert.equal(changeSourceFor({ state: { auth: { strategy: { name: 'api-token' } } }, request: { path: '/api/canonical-listings/3' } }), 'agent');
  assert.equal(changeSourceFor({}), 'agent');
  assert.equal(changeSourceFor(undefined), 'system');
});

function fakeDb({ fail = false } = {}) {
  const written = [];
  return {
    written,
    query(uid) {
      assert.equal(uid, 'api::listing-history.listing-history');
      return {
        create: async ({ data }) => {
          if (fail) throw new Error('database gone');
          written.push(data);
          return { id: written.length };
        },
      };
    },
  };
}

test('writing history never throws: a failed write is logged and the save goes on', async () => {
  const logged = [];
  const log = { error: (m) => logged.push(m) };
  const rows = historyRows({ changes: [{ changedField: 'status', previousValueJson: 'a', nextValueJson: 'b' }], listingId: 1, now: 'n', source: 'agent' });
  const ok = fakeDb();
  assert.equal(await writeHistory(ok, rows, log), 1);
  assert.equal(ok.written.length, 1);
  assert.equal(await writeHistory(fakeDb({ fail: true }), rows, log), 0);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /listing-history/);
  assert.equal(await writeHistory(ok, [], log), 0);
});

// The lifecycle, against a stand-in Strapi.
const HISTORY = 'api::listing-history.listing-history';
const LISTING = 'api::canonical-listing.canonical-listing';

function stubStrapi({ stored, failHistory = false, ctx } = {}) {
  const history = [];
  const logged = [];
  const pick = (row, select) => Object.fromEntries(select.map((k) => [k, row[k] ?? null]));
  const db = {
    query(uid) {
      if (uid === LISTING) return {
        findOne: async () => (stored ? { ...stored } : null),
        findMany: async ({ select }) => (stored ? [pick(stored, select)] : []),
        update: async () => ({}),
      };
      if (uid === HISTORY) return {
        create: async ({ data }) => {
          if (failHistory) throw new Error('database gone');
          history.push(data);
          return {};
        },
      };
      throw new Error(`unexpected ${uid}`);
    },
  };
  global.strapi = { db, log: { error: (m) => logged.push(m), warn() {}, info() {} }, requestContext: { get: () => ctx } };
  return { history, logged };
}

const hooks = () => require(path.join(__dirname, '..', 'api', 'canonical-listing', 'content-types', 'canonical-listing', 'lifecycles.js'));
const tokenCtx = { state: { auth: { strategy: { name: 'api-token' } } }, request: { path: '/api/canonical-listings/5' } };

test('updating a listing writes a history row for each changed field after the save', async () => {
  const { history } = stubStrapi({ stored: { id: 5, status: 'active', publishedAt: '2026-10-01T10:00:00.000Z' }, ctx: tokenCtx });
  const event = { params: { where: { id: 5 }, data: { status: 'sold' } }, state: {} };
  await hooks().beforeUpdate(event);
  assert.equal(history.length, 0, 'nothing is written before the save');
  await hooks().afterUpdate({ ...event, result: { id: 5, status: 'sold' } });
  assert.equal(history.length, 1);
  assert.equal(history[0].listing, 5);
  assert.equal(history[0].changedField, 'status');
  assert.equal(history[0].previousValueJson, 'active');
  assert.equal(history[0].nextValueJson, 'sold');
  assert.equal(history[0].changeSource, 'agent');
  assert.ok(!Number.isNaN(Date.parse(history[0].changedAt)));
  // The status stamps still run: a sale is dated.
  assert.ok(event.params.data.soldAt);
});

test('an update that touches neither status nor publishing writes no history', async () => {
  const { history } = stubStrapi({ stored: { id: 5, status: 'active', publishedAt: null }, ctx: tokenCtx });
  const event = { params: { where: { id: 5 }, data: { title: 'Renamed' } }, state: {} };
  await hooks().beforeUpdate(event);
  await hooks().afterUpdate({ ...event, result: { id: 5 } });
  assert.equal(history.length, 0);
});

// Review, 26 Oct: the website creates every listing with a fixed publishedAt (status decides what
// shows), so a create recorded a false "Published" line on every new draft. Only the status counts.
test('creating a listing writes its first status only', async () => {
  const { history } = stubStrapi({ ctx: { state: { auth: { strategy: { name: 'admin' } } }, request: { path: '/content-manager/x' } } });
  const at = '2026-10-26T12:00:00.000Z';
  await hooks().afterCreate({ params: { data: {} }, state: {}, result: { id: 9, status: 'active', publishedAt: at } });
  assert.deepEqual(history.map((h) => [h.listing, h.changedField, h.nextValueJson, h.changeSource]), [
    [9, 'status', 'active', 'admin'],
  ]);
});

test('the admin panel bulk publish writes a row per listing it published', async () => {
  const { history } = stubStrapi({ stored: { id: 4, status: 'active', publishedAt: null, listedAt: '2026-10-01' } });
  const at = new Date('2026-10-26T12:00:00.000Z');
  const event = { params: { where: { id: { $in: [4] } }, data: { publishedAt: at } }, state: {} };
  await hooks().beforeUpdateMany(event);
  await hooks().afterUpdateMany({ ...event, result: { count: 1 } });
  assert.deepEqual(history.map((h) => [h.listing, h.changedField, h.previousValueJson, h.nextValueJson, h.changeSource]), [
    [4, 'publishedAt', null, at.toISOString(), 'system'],
  ]);
});

test('a bulk status change still fails loudly', async () => {
  stubStrapi({ stored: { id: 4, status: 'active', publishedAt: null } });
  await assert.rejects(async () => hooks().beforeUpdateMany({ params: { where: {}, data: { status: 'sold' } }, state: {} }), /one listing at a time/);
});

test('a failed history write never fails the listing save', async () => {
  const { logged } = stubStrapi({ stored: { id: 5, status: 'active', publishedAt: null }, failHistory: true, ctx: tokenCtx });
  const event = { params: { where: { id: 5 }, data: { status: 'sold' } }, state: {} };
  await hooks().beforeUpdate(event);
  await hooks().afterUpdate({ ...event, result: { id: 5 } });
  await hooks().afterCreate({ params: { data: {} }, state: {}, result: { id: 6, status: 'draft', publishedAt: null } });
  assert.equal(logged.length, 2);
});
