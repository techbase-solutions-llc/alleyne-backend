'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clean } = require('./saved-search-input');

test('a user can only write name, filters and the alert switch, bounded (TEC-1343 review)', () => {
  const nl = String.fromCharCode(10), cr = String.fromCharCode(13), nul = String.fromCharCode(0);
  assert.deepEqual(
    clean({ name: ' Buy' + nl + 'Bcc: x' + cr + nul, filtersJson: { query: 'type=for_sale', summary: 'Buy', extra: 1 }, alertEnabled: true, lastAlertedAt: '2020-01-01', user: 99 }),
    { name: 'Buy Bcc: x', filtersJson: { query: 'type=for_sale', summary: 'Buy' }, alertEnabled: true }
  );
  assert.equal(clean({ name: 'x'.repeat(400) }).name.length, 250);
  assert.deepEqual(clean({ filtersJson: { query: 'q'.repeat(4001) } }), {}, 'oversized query refused');
  assert.deepEqual(clean({ filtersJson: 'type=for_sale', alertEnabled: 'yes' }), {}, 'wrong types ignored');
});
