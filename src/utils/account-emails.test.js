// Run: npm test
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATE_VERSION, accountTemplates, moveSite, nextEmailSettings, siteConfirmLink, noticeEmail, siteUrl } = require('./account-emails');
const { htmlToText } = require('./email-text');

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
  // Reset links expire after 60 minutes (plan A1, 26 Oct 2026).
  assert.match(reset, /The link works once, within 60 minutes\./);
  assert.ok(!/only once/.test(reset));
});

test('first boot of this version writes the wording; later boots keep admin-panel edits', () => {
  const first = nextEmailSettings({ templates: { reset_password: { options: { message: 'old v1', object: 'old' } } }, written: null, site: SITE, from: FROM, replyTo: '', now: new Date('2026-10-12T12:00:00Z') });
  assert.equal(first.email.reset_password.options.message, accountTemplates(SITE).reset_password.message);
  assert.equal(first.email.reset_password.options.from, FROM);
  assert.equal(first.email.reset_password.options.response_email, 'info@jalbarbados.com');
  assert.deepEqual(first.version, { at: '2026-10-12T12:00:00.000Z', site: SITE });
  assert.equal(TEMPLATE_VERSION, 'alleyne-email-templates-v3');

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

// Review, 13 Oct: a plain substring swap turned https://jalbarbados.com into
// https://www.www.jalbarbados.com when the new site only added www, and changed
// info@jalbarbados.com into info@www.jalbarbados.com.
test('moving to a www address changes the site and its host once, never an email address', () => {
  const msg = '<a href="https://jalbarbados.com/x">jalbarbados.com</a> write to info@jalbarbados.com';
  assert.equal(
    moveSite(msg, 'https://jalbarbados.com', 'https://www.jalbarbados.com'),
    '<a href="https://www.jalbarbados.com/x">www.jalbarbados.com</a> write to info@jalbarbados.com'
  );
});

// Plain text (plan A4, 26 Oct 2026): Strapi sent the HTML as the text part too.
test('the reset and confirm emails read properly as plain text once Strapi has filled them', () => {
  const t = accountTemplates(SITE);
  const reset = t.reset_password.message.split('<%= URL %>').join(`${SITE}/reset-password`).split('<%= TOKEN %>').join('abc123');
  assert.equal(htmlToText(reset), [
    'Your account',
    '',
    'RESET YOUR PASSWORD',
    '',
    'We had a request to reset the password for your Alleyne account. Press the button to choose a new one.',
    '',
    'Choose a new password: https://www.example.com/reset-password?code=abc123',
    '',
    'If the button does not work, copy this link into your browser:',
    'https://www.example.com/reset-password?code=abc123',
    '',
    'Did not ask for this? Ignore this email and your password stays the same. If it keeps happening, write to info@jalbarbados.com.',
    '',
    'The link works once, within 60 minutes.',
    '',
    '--',
    'Alleyne Real Estate · Chattel Village, Holetown, St James, Barbados',
    '1 (246) 432-1159 · www.example.com',
    'You got this because someone asked to reset the password for this address on www.example.com.',
    '',
  ].join('\n'));
  const confirm = htmlToText(t.email_confirmation.message.split('<%= CODE %>').join('xyz'));
  assert.match(confirm, /^Your account\n\nCONFIRM YOUR EMAIL\n\nWelcome to Alleyne Real Estate\./);
  assert.match(confirm, /\nConfirm my email: https:\/\/www\.example\.com\/confirm-email\?confirmation=xyz\n/);
  assert.ok(!/<|>|&amp;/.test(confirm), 'no markup left');
});

// Account notices the backend sends itself (plan D4 backend side, 26 Oct 2026).
const notices = ['password_changed', 'welcome', 'account_exists'];

test('each account notice has a subject, HTML in the account email layout and its own plain text', () => {
  for (const kind of notices) {
    const e = noticeEmail(kind, { site: `${SITE}/`, when: new Date('2026-10-26T18:15:00Z') });
    assert.ok(e.subject && e.subject.includes('Alleyne Real Estate'), kind);
    assert.match(e.html, /^<!DOCTYPE html>/);
    assert.match(e.html, /<img src="https:\/\/www\.example\.com\/brand\/alleyne-wordmark-email\.png" width="200" height="40" alt="Alleyne Real Estate"/);
    assert.match(e.html, /Chattel Village, Holetown, St James, Barbados/);
    assert.match(e.html, /href="https:\/\/www\.example\.com\/signin"/, `${kind} links to sign in on the site`);
    assert.equal(htmlToText(e.html), e.text, `${kind}: the text part is the HTML's own words`);
    for (const m of [e.html, e.text, e.subject]) {
      assert.ok(!/—/.test(m), `${kind}: no em dashes`);
      assert.ok(!/techbase/i.test(m), `${kind}: never names Techbase`);
      assert.ok(!/__SITE__|__HOST__|<%|\$\{|undefined|null/.test(m), `${kind}: nothing left unfilled`);
    }
    assert.match(e.text, /\n--\nAlleyne Real Estate · Chattel Village, Holetown, St James, Barbados\n1 \(246\) 432-1159 · www\.example\.com\nYou got this because /);
  }
});

test('the password-changed notice says when, in Barbados time, and how to get the account back', () => {
  const e = noticeEmail('password_changed', { site: SITE, when: new Date('2026-10-26T18:15:00Z') });
  assert.equal(e.subject, 'Your Alleyne Real Estate password was changed');
  assert.match(e.text, /YOUR PASSWORD WAS CHANGED/);
  assert.match(e.text, /26 October 2026 at 2:15 ?pm \(Barbados time\)/);
  assert.match(e.text, /signed in anywhere else/);
  assert.match(e.text, /Sign in: https:\/\/www\.example\.com\/signin/);
  assert.match(e.html, /href="https:\/\/www\.example\.com\/forgot-password"/);
  assert.match(e.text, /https:\/\/www\.example\.com\/forgot-password/);
});

test('the welcome email follows a confirmed email; the already-registered one changes nothing', () => {
  const w = noticeEmail('welcome', { site: SITE });
  assert.equal(w.subject, 'Welcome to Alleyne Real Estate');
  assert.match(w.text, /YOUR ACCOUNT IS READY/);
  const x = noticeEmail('account_exists', { site: SITE });
  assert.equal(x.subject, 'You already have an Alleyne Real Estate account');
  assert.match(x.text, /no new one was made/);
  assert.match(x.text, /https:\/\/www\.example\.com\/forgot-password/);
  assert.match(x.text, /Nothing has changed on your account\./);
  assert.throws(() => noticeEmail('nonsense', { site: SITE }));
});

test('the site address comes from SITE_URL, without a trailing slash, with the preview address as fallback', () => {
  assert.equal(siteUrl({ SITE_URL: 'https://www.jalbarbados.com/' }), 'https://www.jalbarbados.com');
  assert.equal(siteUrl({}), 'https://alleyne-real-estate.vercel.app');
});
