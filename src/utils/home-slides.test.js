'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { slidesProblem, MAX_SLIDES } = require('./home-slides');

const ok = (extra = {}) => ({ url: 'https://x.public.blob.vercel-storage.com/listings/uploads/home-slides/a.jpg', width: 1920, height: 1080, caption: '', link: '', ...extra });

test('a well-formed list (or an empty one) is accepted', () => {
  assert.equal(slidesProblem([]), null);
  assert.equal(slidesProblem([ok(), ok({ caption: 'Sandalo, Sandy Lane', link: '/listing/sandalo' }), ok({ link: 'https://www.jalbarbados.com/' })]), null);
});

test('anything that is not a list of slides is refused', () => {
  assert.equal(typeof slidesProblem(null), 'string');
  assert.equal(typeof slidesProblem('x'), 'string');
  assert.equal(typeof slidesProblem({}), 'string');
  assert.equal(typeof slidesProblem([null]), 'string');
});

test('each slide needs an https picture and its size', () => {
  assert.equal(typeof slidesProblem([ok({ url: 'http://x.com/a.jpg' })]), 'string');
  assert.equal(typeof slidesProblem([ok({ url: 42 })]), 'string');
  assert.equal(typeof slidesProblem([ok({ width: 0 })]), 'string');
  assert.equal(typeof slidesProblem([ok({ height: '1080' })]), 'string');
});

test('captions are capped and links must be a site page or an https address', () => {
  assert.equal(typeof slidesProblem([ok({ caption: 'x'.repeat(81) })]), 'string');
  assert.equal(typeof slidesProblem([ok({ link: 'javascript:alert(1)' })]), 'string');
  assert.equal(typeof slidesProblem([ok({ link: '//evil.example.com' })]), 'string');
  assert.equal(typeof slidesProblem([ok({ link: '/a b' })]), 'string');
});

test('the list is capped', () => {
  assert.equal(typeof slidesProblem(Array.from({ length: MAX_SLIDES + 1 }, ok)), 'string');
});
