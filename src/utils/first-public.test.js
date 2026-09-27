'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicPatch, barbadosDate } = require('./first-public');

const now = '2026-09-27T15:04:05.000Z';
const P = '2023-11-14T22:13:20.000Z'; // any publishedAt
const pub = (o) => publicPatch({ now, ...o });

test('stamped the first time a listing becomes both available and published (TEC-1343)', () => {
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P }, next: { status: 'active' } }), { firstPublicAt: now, listedAt: '2026-09-27' });
  assert.deepEqual(pub({ prev: null, next: { status: 'active', publishedAt: P } }), { firstPublicAt: now, listedAt: '2026-09-27' }, 'created active and published');
  assert.deepEqual(pub({ prev: null, next: { status: 'draft', publishedAt: P } }), {}, 'a draft is not listed');
  assert.deepEqual(pub({ prev: null, next: { status: 'active', publishedAt: null } }), {}, 'active but unpublished is not public');
  assert.deepEqual(pub({ prev: { status: 'active', publishedAt: null }, next: { publishedAt: P } }), { firstPublicAt: now, listedAt: '2026-09-27' }, 'the Publish action alone makes it public');
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: null }, next: { status: 'active' } }), {}, 'status active while unpublished waits for Publish');
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P, listedAt: '2026-08-01' }, next: { status: 'active' } }), { firstPublicAt: now }, 'an existing listing date is kept');
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P, firstPublicAt: '2026-09-01T00:00:00Z' }, next: { status: 'active' } }), {}, 'only the first time');
  assert.deepEqual(pub({ prev: { status: 'active', publishedAt: P }, next: { status: 'under_offer' } }), {}, 'already public');
  assert.deepEqual(pub({ prev: { status: 'suppressed', publishedAt: P }, next: { status: 'active' } }), { firstPublicAt: now, listedAt: '2026-09-27' });
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P }, next: { status: 'sold' } }), {}, 'straight to sold is not a new listing (review)');
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P }, next: { title: 'x' } }), {}, 'no status or publish change');
  assert.deepEqual(pub({ prev: { status: 'draft', publishedAt: P }, next: { status: 'active', firstPublicAt: '2026-01-01T00:00:00Z' } }), {}, 'an explicit value in the save is respected');
});

test('the listing date is the Barbados calendar date (UTC-4, no daylight saving)', () => {
  assert.equal(barbadosDate('2026-09-27T15:00:00.000Z'), '2026-09-27');
  assert.equal(barbadosDate('2026-09-28T02:30:00.000Z'), '2026-09-27', '10:30pm in Barbados is still the 27th');
  assert.deepEqual(publicPatch({ now: '2026-09-28T02:30:00.000Z', prev: null, next: { status: 'active', publishedAt: P } }), { firstPublicAt: '2026-09-28T02:30:00.000Z', listedAt: '2026-09-27' });
});
