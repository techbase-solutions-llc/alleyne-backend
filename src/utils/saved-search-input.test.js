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

const { userIdOf } = require('./saved-search-input');

test('turning alerts off from an email link names one account by a whole positive number (review, 8 Oct)', () => {
  assert.equal(userIdOf({ userId: 41 }), 41);
  assert.equal(userIdOf({ userId: '41' }), 41);
  for (const bad of [{}, null, undefined, { userId: 0 }, { userId: -3 }, { userId: 1.5 }, { userId: 'x' }, { userId: [41] }, { userId: { $gt: 0 } }])
    assert.equal(userIdOf(bad), null, JSON.stringify(bad));
});

const { clientLabel } = require('./saved-search-input');

test('a client label (8 Oct meeting) is a one-line name and note, bounded, and only when given', () => {
  const nl = String.fromCharCode(10);
  assert.deepEqual(clientLabel({ clientName: '  Ann' + nl + 'Smith ', clientNote: ' Beachfront' + nl + 'only ' }), { clientName: 'Ann Smith', clientNote: 'Beachfront only' });
  assert.deepEqual(clientLabel({ clientName: '', clientNote: '' }), { clientName: null, clientNote: null }, 'empty clears the label');
  assert.deepEqual(clientLabel({ clientName: 'Ann' }), { clientName: 'Ann' }, 'only the fields sent');
  assert.deepEqual(clientLabel({ clientName: '', clientNote: 'a note' }), { clientName: null, clientNote: null }, 'no name: no note either');
  assert.equal(clientLabel({ clientName: 'n'.repeat(200) }).clientName.length, 80);
  assert.equal(clientLabel({ clientName: 'Ann', clientNote: 'x'.repeat(900) }).clientNote.length, 300);
  assert.deepEqual(clientLabel({ clientName: 5, clientNote: ['x'] }), {}, 'wrong types ignored');
  assert.deepEqual(clientLabel(null), {});
  // The ordinary fields never carry a label: it is kept only for team members (controller).
  assert.deepEqual(clean({ name: 'Buy', clientName: 'Ann' }), { name: 'Buy' });
});
