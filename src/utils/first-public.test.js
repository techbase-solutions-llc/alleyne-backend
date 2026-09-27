'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicPatch } = require('./first-public');

const now = '2026-09-27T15:04:05.000Z';

test('a listing is stamped the first time it goes public, and keeps its dates after that (TEC-1343)', () => {
  assert.deepEqual(publicPatch({ prevStatus: 'draft', nextStatus: 'active', prev: {}, now }), { firstPublicAt: now, listedAt: '2026-09-27' });
  assert.deepEqual(publicPatch({ prevStatus: null, nextStatus: 'active', prev: {}, now }), { firstPublicAt: now, listedAt: '2026-09-27' }, 'created straight as active');
  assert.deepEqual(publicPatch({ prevStatus: null, nextStatus: 'draft', prev: {}, now }), {}, 'a draft is not listed');
  assert.deepEqual(publicPatch({ prevStatus: null, nextStatus: undefined, prev: {}, now }), {}, 'created without a status is a draft (schema default)');
  assert.deepEqual(publicPatch({ prevStatus: 'draft', nextStatus: 'active', prev: { listedAt: '2026-08-01' }, now }), { firstPublicAt: now }, 'an existing listing date is kept');
  assert.deepEqual(publicPatch({ prevStatus: 'draft', nextStatus: 'active', prev: { firstPublicAt: '2026-09-01T00:00:00Z' }, now }), {}, 'only the first time');
  assert.deepEqual(publicPatch({ prevStatus: 'active', nextStatus: 'under_offer', prev: {}, now }), {}, 'already public before');
  assert.deepEqual(publicPatch({ prevStatus: 'suppressed', nextStatus: 'active', prev: {}, now }), { firstPublicAt: now, listedAt: '2026-09-27' });
  assert.deepEqual(publicPatch({ prevStatus: 'draft', nextStatus: undefined, prev: {}, now }), {}, 'status not changed');
  assert.deepEqual(publicPatch({ prevStatus: 'draft', nextStatus: 'active', prev: {}, now, incoming: { firstPublicAt: '2026-01-01T00:00:00Z' } }), {}, 'an explicit value in the save is respected');
});
