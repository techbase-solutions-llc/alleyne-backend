// Run: npm test
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATE_VERSION, accountTemplates, moveSite, nextEmailSettings, siteConfirmLink } = require('./account-emails');

const SITE = 'https://www.example.com';
const FROM = { name: 'Alleyne Real Estate', email: 'info@jalbarbados.com' };

test('the templates carry Strapi\'s placeholders and the site address, nothing else to fill', () => {
  const t = accountTemplates(`${SITE}/`);
  assert.equal(t.reset_password.object, 'Reset your Alleyne Real Estate password');
  assert.equal(t.email_confirmation.object, 'Confirm your email for Alleyne Real Estate');
  const reset = t.reset_password.message, confirm = t.email_confirmation.message;
  assert.match(reset, /href="<%= URL %>\?code=<%= TOKEN %>"[^>]*>Choose a new password<\/a>/);
  assert.match(confirm, /href="https:\/\/www\.example\.com\/confirm-email\?confirmation=<%= CODE %>"[^>]*>Confirm my email<\/a>/);
  for (const m of [reset, confirm]) {
    assert.ok(!/__SITE__|__HOST__/.test(m));
    assert.match(m, /<img src="https:\/\/www\.example\.com\/brand\/alleyne-wordmark-email\.png" width="200" height="40" alt="Alleyne Real Estate"/);
    assert.match(m, />www\.example\.com<\/a>/, 'the footer shows the site host');
    assert.match(m, /Chattel Village, Holetown, St James, Barbados/);
    // Strapi refuses a template with evaluation blocks or ${} (users-permissions isValidEmailTemplate).
    assert.ok(!/<%[^=]|\$\{/.test(m));
    assert.ok(!/—/.test(m), 'no em dashes');
    assert.ok(!/1 hour|alleyne\.bb/.test(m));
  }
  assert.match(reset, /The link works only once\./);
});

test('first boot of this version writes the wording; later boots keep admin-panel edits', () => {
  const first = nextEmailSettings({ templates: { reset_password: { options: { message: 'old v1', object: 'old' } } }, written: null, site: SITE, from: FROM, replyTo: '', now: new Date('2026-10-12T12:00:00Z') });
  assert.equal(first.email.reset_password.options.message, accountTemplates(SITE).reset_password.message);
  assert.equal(first.email.reset_password.options.from, FROM);
  assert.equal(first.email.reset_password.options.response_email, 'info@jalbarbados.com');
  assert.deepEqual(first.version, { at: '2026-10-12T12:00:00.000Z', site: SITE });
  assert.equal(TEMPLATE_VERSION, 'alleyne-email-templates-v2');

  const edited = { ...first.email, reset_password: { options: { ...first.email.reset_password.options, message: 'Edited in the admin panel <%= URL %>?code=<%= TOKEN %>' } } };
  const later = nextEmailSettings({ templates: edited, written: first.version, site: SITE, from: { name: '', email: '' }, replyTo: 'help@x.co' });
  assert.equal(later.email.reset_password.options.message, 'Edited in the admin panel <%= URL %>?code=<%= TOKEN %>');
  assert.equal(later.email.reset_password.options.from, FROM, 'an unset sender leaves the sender as it is');
  assert.equal(later.email.reset_password.options.response_email, 'help@x.co');
  assert.equal(later.version, null, 'nothing to record');
});

test('a new site address (the cutover) moves the saved wording to it, edits kept', () => {
  const OLD = 'https://alleyne-real-estate.vercel.app';
  const saved = nextEmailSettings({ templates: {}, written: null, site: OLD, from: FROM }).email;
  saved.email_confirmation.options.message += '<p>An admin edit</p>';
  const moved = nextEmailSettings({ templates: saved, written: { at: 'x', site: OLD }, site: SITE, from: FROM, now: new Date('2026-11-01T00:00:00Z') });
  const m = moved.email.email_confirmation.options.message;
  assert.ok(!m.includes('vercel.app'));
  assert.match(m, /https:\/\/www\.example\.com\/brand\/alleyne-wordmark-email\.png/);
  assert.match(m, /href="https:\/\/www\.example\.com\/confirm-email\?confirmation=<%= CODE %>"/);
  assert.match(m, /opened on www\.example\.com with this address/);
  assert.match(m, /An admin edit/);
  assert.deepEqual(moved.version, { at: '2026-11-01T00:00:00.000Z', site: SITE });
  assert.equal(moveSite('x', null, SITE), 'x');
  assert.equal(moveSite(undefined, OLD, SITE), undefined);
});

test('the confirm link is pointed at the site whatever quotes or spaces an edit used', () => {
  const t = siteConfirmLink({ options: { message: "<a href='https://api.test/auth/email-confirmation?confirmation=<%=CODE%>'>x</a>" } }, `${SITE}/`);
  assert.equal(t.options.message, '<a href="https://www.example.com/confirm-email?confirmation=<%= CODE %>">x</a>');
  assert.equal(siteConfirmLink(undefined, SITE), undefined);
});
