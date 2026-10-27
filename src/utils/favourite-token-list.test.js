'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isServerToken, tokenListPage } = require('./favourite-token-list');

// Review, 26 Oct (TEC-1909, plan D3): the website's daily alert run reads every saved property
// with its server token, to tell people when a saved property's price drops, it sells or lets,
// or it comes back. Only ids and the last told price and status, never names or emails.
test('only a full-access API token counts as the server, as for saved searches (review, 27 Oct)', () => {
  const token = (type) => ({ state: { auth: { strategy: { name: 'api-token' }, credentials: { type } } } });
  assert.equal(isServerToken(token('full-access')), true);
  assert.equal(isServerToken(token('read-only')), false);
  assert.equal(isServerToken(token('custom')), false);
  assert.equal(isServerToken({ state: { auth: { strategy: { name: 'api-token' } } } }), false);
  assert.equal(isServerToken({ state: { auth: { strategy: { name: 'users-permissions' } }, user: { id: 1 } } }), false);
  assert.equal(isServerToken({ state: {} }), false);
});

test('a page lists owner, listing and last told values, in the Strapi 4 shape', () => {
  const rows = [
    { id: 7, notifiedPriceMinor: '450000000', notifiedStatus: 'active', user: { id: 3, email: 'x@y.z', username: 'Ann' }, listing: { id: 31, title: 'Villa' } },
    { id: 8, notifiedPriceMinor: null, notifiedStatus: null, user: null, listing: { id: 32 } },
  ];
  const out = tokenListPage(rows, { page: 2, pageSize: 100, total: 108 });
  assert.deepEqual(out.data[0], { id: 7, attributes: { notifiedPriceMinor: '450000000', notifiedStatus: 'active', user: { data: { id: 3 } }, listing: { data: { id: 31 } } } });
  assert.deepEqual(out.data[1].attributes.user, { data: null });
  assert.deepEqual(out.meta.pagination, { page: 2, pageSize: 100, pageCount: 2, total: 108 });
  assert.doesNotMatch(JSON.stringify(out), /x@y\.z|Ann|Villa/);
});
