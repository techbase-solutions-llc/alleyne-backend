'use strict';
// Run: npm test
// 27 Oct: the old Realtlist sync code fell back to a realtlist.com sender. It now uses the
// backend's own sender settings, or sends nothing.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { legacySyncSender } = require('./legacy-sync-sender');

test('the sync notice uses RESEND_FROM_EMAIL, then EMAIL_FROM, else nothing', () => {
  assert.equal(legacySyncSender({ RESEND_FROM_EMAIL: 'a@jalbarbados.com', EMAIL_FROM: 'b@jalbarbados.com' }), 'a@jalbarbados.com');
  assert.equal(legacySyncSender({ EMAIL_FROM: 'Alleyne <b@jalbarbados.com>' }), 'Alleyne <b@jalbarbados.com>');
  assert.equal(legacySyncSender({}), null);
});

test('the sync runner no longer falls back to a realtlist.com sender', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api', 'source-connection', 'lib', 'sync-runner.js'), 'utf8');
  assert.doesNotMatch(src, /noreply@realtlist\.com/);
  assert.match(src, /legacySyncSender\(process\.env\)/);
});
