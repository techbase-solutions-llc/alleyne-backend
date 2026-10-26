'use strict';
// Run: npm test
// A deleted listing takes its office notes with it (session 4 review, 23 Oct 2026; TEC-1909).
// Before this, the notes stayed in the database with their listing link emptied, shown
// nowhere and never cleaned up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LISTING = 'api::canonical-listing.canonical-listing';
const NOTE = 'api::listing-note.listing-note';
const TRANSACTION = 'api::listing-transaction.listing-transaction';

// A small stand-in for strapi.db: listings 1 and 2, notes on each, and the calls it saw.
function fakeDb() {
  const listings = [{ id: 1 }, { id: 2 }];
  const notes = [{ id: 10, listing: 1 }, { id: 11, listing: 1 }, { id: 12, listing: 2 }];
  const transactions = [{ id: 20, listing: 1 }, { id: 21, listing: 2 }, { id: 22, listing: 2 }];
  const calls = [];
  const matchListing = (where) => {
    if (where?.id?.$in) return listings.filter((l) => where.id.$in.includes(l.id));
    if (where?.id !== undefined) return listings.filter((l) => l.id === where.id);
    return listings;
  };
  const db = {
    calls,
    notes,
    transactions,
    query(uid) {
      if (uid === LISTING) return { findMany: async ({ where }) => matchListing(where).map(({ id }) => ({ id })) };
      if (uid === NOTE) return {
        findMany: async ({ where }) => notes.filter((n) => where.listing.id.$in.includes(n.listing)).map(({ id }) => ({ id })),
        deleteMany: async ({ where }) => {
          calls.push(['deleteMany', where.id.$in]);
          let count = 0;
          for (let i = notes.length - 1; i >= 0; i--) if (where.id.$in.includes(notes[i].id)) { notes.splice(i, 1); count++; }
          return { count };
        },
      };
      if (uid === TRANSACTION) return {
        findMany: async ({ where }) => transactions.filter((t) => where.listing.id.$in.includes(t.listing)).map(({ id }) => ({ id })),
        deleteMany: async ({ where }) => {
          calls.push(['deleteMany transactions', where.id.$in]);
          let count = 0;
          for (let i = transactions.length - 1; i >= 0; i--) if (where.id.$in.includes(transactions[i].id)) { transactions.splice(i, 1); count++; }
          return { count };
        },
      };
      throw new Error(`unexpected ${uid}`);
    },
  };
  return db;
}

const { notesToRemove, removeNotes } = require('./listing-note-cleanup');

test('the notes of the listings being deleted are found before the delete', async () => {
  const db = fakeDb();
  assert.deepEqual(await notesToRemove(db, { id: 1 }), [10, 11]);
  assert.deepEqual(await notesToRemove(db, { id: { $in: [1, 2] } }), [10, 11, 12]);
  assert.deepEqual(await notesToRemove(db, { id: 99 }), []);
});

test('removing deletes exactly those notes, and nothing when there are none', async () => {
  const db = fakeDb();
  assert.equal(await removeNotes(db, [10, 11]), 2);
  assert.deepEqual(db.notes.map((n) => n.id), [12]);
  assert.equal(await removeNotes(db, []), 0);
  assert.equal(await removeNotes(db, undefined), 0);
  assert.equal(db.calls.length, 1, 'no delete is sent for an empty list');
});

function lifecycles(db) {
  global.strapi = { db };
  return require(path.join(__dirname, '..', 'api', 'canonical-listing', 'content-types', 'canonical-listing', 'lifecycles.js'));
}

test('deleting a listing (one, or many from the admin panel) removes its notes afterwards', async () => {
  const db = fakeDb();
  const hooks = lifecycles(db);
  // Strapi hands the same state to a hook's before and after halves.
  const one = { params: { where: { id: 1 } }, state: {} };
  await hooks.beforeDelete(one);
  assert.deepEqual(db.notes.map((n) => n.id), [10, 11, 12], 'nothing goes before the listing does');
  await hooks.afterDelete(one);
  assert.deepEqual(db.notes.map((n) => n.id), [12]);

  const many = { params: { where: { id: { $in: [2] } } }, state: {} };
  await hooks.beforeDeleteMany(many);
  await hooks.afterDeleteMany(many);
  assert.deepEqual(db.notes, []);
});

// Listing transactions go with their listing too (Orna, 23 Oct 2026; TEC-1909).
const { officeRecordsToRemove, removeOfficeRecords } = require('./listing-note-cleanup');

test('the notes and transactions of the listings being deleted are found before the delete', async () => {
  const db = fakeDb();
  assert.deepEqual(await officeRecordsToRemove(db, { id: 1 }), { notes: [10, 11], transactions: [20] });
  assert.deepEqual(await officeRecordsToRemove(db, { id: { $in: [1, 2] } }), { notes: [10, 11, 12], transactions: [20, 21, 22] });
  assert.deepEqual(await officeRecordsToRemove(db, { id: 99 }), { notes: [], transactions: [] });
});

test('removing office records deletes exactly those, and sends nothing for an empty list', async () => {
  const db = fakeDb();
  assert.deepEqual(await removeOfficeRecords(db, { notes: [12], transactions: [21, 22] }), { notes: 1, transactions: 2 });
  assert.deepEqual(db.notes.map((n) => n.id), [10, 11]);
  assert.deepEqual(db.transactions.map((t) => t.id), [20]);
  assert.deepEqual(await removeOfficeRecords(db, { notes: [], transactions: [] }), { notes: 0, transactions: 0 });
  assert.deepEqual(await removeOfficeRecords(db, undefined), { notes: 0, transactions: 0 });
  assert.equal(db.calls.length, 2);
});

test('deleting a listing (one, or many from the admin panel) removes its transactions afterwards', async () => {
  const db = fakeDb();
  const hooks = lifecycles(db);
  const one = { params: { where: { id: 2 } }, state: {} };
  await hooks.beforeDelete(one);
  assert.deepEqual(db.transactions.map((t) => t.id), [20, 21, 22], 'nothing goes before the listing does');
  await hooks.afterDelete(one);
  assert.deepEqual(db.transactions.map((t) => t.id), [20]);
  assert.deepEqual(db.notes.map((n) => n.id), [10, 11]);

  const many = { params: { where: { id: { $in: [1] } } }, state: {} };
  await hooks.beforeDeleteMany(many);
  await hooks.afterDeleteMany(many);
  assert.deepEqual(db.transactions, []);
  assert.deepEqual(db.notes, []);
});
