// Run: npm test
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { htmlToText, withPlainText } = require('./email-text');

test('links read as "label: address", except a phone, an email, a bare address or a host name', () => {
  const html = '<table><tr><td><p>Hi &amp; welcome<br>to <a href="https://x.co/a?b=1&amp;c=2">See it</a></p></td></tr>' +
    '<tr><td><a href="tel:+12464321159">1 (246) 432-1159</a> · <a href="mailto:info@x.co">info@x.co</a> · <a href="https://x.co">x.co</a></td></tr>' +
    '<tr><td><a href="https://x.co/long">https://x.co/long</a> <a href="https://x.co"><img src="logo.png" alt="Logo"></a></td></tr></table>';
  assert.equal(htmlToText(html), 'Hi & welcome\nto See it: https://x.co/a?b=1&c=2\n\n1 (246) 432-1159 · info@x.co · x.co\n\nhttps://x.co/long\n');
});

test('the head, the hidden preview line and empty rows are left out', () => {
  const html = '<!DOCTYPE html><html><head><title>T</title><style>p{}</style></head><body>' +
    '<div style="display:none;max-height:0">Preview line</div><table><tr><td></td></tr><tr><td><h1>Hello there</h1></td></tr></table></body></html>';
  assert.equal(htmlToText(html), 'HELLO THERE\n');
});

test('the text part is made from the HTML when Strapi sent the HTML as text, and only then', () => {
  const html = '<table><tr><td><p>Hello</p></td></tr></table>';
  assert.equal(withPlainText({ to: 'a@b.co', html, text: html }).text, 'Hello\n');
  assert.equal(withPlainText({ to: 'a@b.co', html }).text, 'Hello\n');
  assert.equal(withPlainText({ to: 'a@b.co', html, text: '' }).text, 'Hello\n');
  assert.equal(withPlainText({ to: 'a@b.co', html, text: 'Own words' }).text, 'Own words');
  assert.deepEqual(withPlainText({ to: 'a@b.co', text: 'Only text' }), { to: 'a@b.co', text: 'Only text' });
  assert.equal(withPlainText(undefined), undefined);
});
