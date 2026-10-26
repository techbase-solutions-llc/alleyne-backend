'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emailConfirmationOn } = require('./email-confirmation');

// Review, 26 Oct: Your requests shows a person the enquiries sent from their confirmed email. If
// confirmation were off, anyone could sign up with someone else's address and read theirs. A
// missing or mistyped setting therefore keeps confirmation on; only "false" turns it off.
test('email confirmation stays on unless the setting says false', () => {
  assert.equal(emailConfirmationOn({}), true);
  assert.equal(emailConfirmationOn({ EMAIL_CONFIRMATION: 'true' }), true);
  assert.equal(emailConfirmationOn({ EMAIL_CONFIRMATION: 'yes' }), true);
  assert.equal(emailConfirmationOn({ EMAIL_CONFIRMATION: ' false ' }), false);
  assert.equal(emailConfirmationOn({ EMAIL_CONFIRMATION: 'FALSE' }), false);
});

test('the bootstrap uses it', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(src, /email_confirmation: emailConfirmationOn\(process\.env\)/);
});
