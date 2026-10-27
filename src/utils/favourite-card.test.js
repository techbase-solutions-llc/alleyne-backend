'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cardOf, goneTitleOf } = require('./favourite-card');

const live = { id: 4, slug: 'coral-house', title: 'Coral House', status: 'active', publishedAt: '2026-10-01', transactionType: 'for_sale', externalImages: ['https://img/1.jpg'] };

test('a listing the public can see gives a card with its first photo', () => {
  const c = cardOf(live);
  assert.equal(c.title, 'Coral House');
  assert.equal(c.image, 'https://img/1.jpg');
  assert.equal(goneTitleOf(live), null);
});

// Review, 27 Oct: a saved property taken off the website showed only "No longer on the
// website", so the person could not tell which one it was. Its name stays; nothing else does.
test('a listing off the website gives no card, only its name', () => {
  for (const status of ['suppressed', 'quiet', 'archived']) {
    const l = { ...live, status };
    assert.equal(cardOf(l), null, status);
    assert.equal(goneTitleOf(l), 'Coral House', status);
  }
  assert.equal(cardOf({ ...live, publishedAt: null }), null);
  assert.equal(goneTitleOf({ ...live, publishedAt: null }), 'Coral House');
});

test('a draft was never public, so not even its name is given', () => {
  assert.equal(goneTitleOf({ ...live, status: 'draft' }), null);
  assert.equal(goneTitleOf(null), null);
});

test('the favourites controller uses the shared card rules and returns the name', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api', 'favorite', 'controllers', 'favorite.js'), 'utf8');
  assert.match(src, /require\('\.\.\/\.\.\/\.\.\/utils\/favourite-card'\)/);
  assert.match(src, /goneTitle/);
  assert.doesNotMatch(src, /const cardOf = /);
});
