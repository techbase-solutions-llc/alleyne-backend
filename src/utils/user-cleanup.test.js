'use strict';
// Run: npm test
// A deleted account takes its saved properties and saved searches with it (plan A5, 26 Oct
// 2026; TEC-1909). Before this, a user delete only emptied their links and the rows stayed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { savedItemsToRemove, removeSavedItems } = require('./user-cleanup');

const USER = 'plugin::users-permissions.user';
const FAV = 'api::favorite.favorite';
const SS = 'api::saved-search.saved-search';

// A stand-in for strapi.db: users 1 to 3, with favourites and saved searches.
function fakeDb() {
  const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const rows = {
    [FAV]: [{ id: 10, user: 1 }, { id: 11, user: 1 }, { id: 12, user: 2 }],
    [SS]: [{ id: 20, user: 1 }, { id: 21, user: 3 }],
  };
  const calls = [];
  const matchUsers = (where) => {
    if (where?.id?.$in) return users.filter((u) => where.id.$in.includes(u.id));
    if (where?.id !== undefined) return users.filter((u) => u.id === where.id);
    return users;
  };
  return {
    rows,
    calls,
    query(uid) {
      if (uid === USER) return { findMany: async ({ where }) => matchUsers(where).map(({ id }) => ({ id })) };
      return {
        findMany: async ({ where }) => rows[uid].filter((r) => where.user.id.$in.includes(r.user)).map(({ id }) => ({ id })),
        deleteMany: async ({ where }) => {
          calls.push([uid, where.id.$in]);
          const before = rows[uid].length;
          rows[uid] = rows[uid].filter((r) => !where.id.$in.includes(r.id));
          return { count: before - rows[uid].length };
        },
      };
    },
  };
}

test("one account's saved properties and searches are found before the delete and removed after it", async () => {
  const db = fakeDb();
  const found = await savedItemsToRemove(db, { id: 1 });
  assert.deepEqual(found, { favourites: [10, 11], savedSearches: [20] });
  assert.deepEqual(db.calls, [], 'nothing removed before the account itself has gone');
  assert.deepEqual(await removeSavedItems(db, found), { favourites: 2, savedSearches: 1 });
  assert.deepEqual(db.rows[FAV].map((r) => r.id), [12], "another account's favourite stays");
  assert.deepEqual(db.rows[SS].map((r) => r.id), [21]);
});

test('a bulk delete clears every account it matches', async () => {
  const db = fakeDb();
  const found = await savedItemsToRemove(db, { id: { $in: [2, 3] } });
  assert.deepEqual(found, { favourites: [12], savedSearches: [21] });
  await removeSavedItems(db, found);
  assert.deepEqual(db.rows[FAV].map((r) => r.id), [10, 11]);
});

test('an account with nothing saved, or no account at all, removes nothing', async () => {
  const db = fakeDb();
  assert.deepEqual(await savedItemsToRemove(db, { id: 99 }), { favourites: [], savedSearches: [] });
  assert.deepEqual(await removeSavedItems(db, { favourites: [], savedSearches: [] }), { favourites: 0, savedSearches: 0 });
  assert.deepEqual(await removeSavedItems(db, undefined), { favourites: 0, savedSearches: 0 });
  assert.deepEqual(db.calls, []);
});
