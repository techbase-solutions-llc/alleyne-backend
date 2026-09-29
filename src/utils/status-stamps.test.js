'use strict';
// Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { statusPatch } = require('./status-stamps');

const now = '2026-09-29T12:00:00.000Z';
const token = () => 'tok123';

test('becoming sold stamps soldAt; staying sold keeps it', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'active' }, next: { status: 'sold' }, now, token }), { soldAt: now });
  assert.deepEqual(statusPatch({ prev: { status: 'sold', soldAt: '2026-09-01T00:00:00.000Z' }, next: { status: 'sold' }, now, token }), {});
});

test('leaving sold (relisted) clears soldAt', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'sold', soldAt: '2026-09-01T00:00:00.000Z' }, next: { status: 'active' }, now, token }), { soldAt: null });
});

test('archiving a sold listing keeps when it sold (history); relisting still clears it', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'sold', soldAt: '2026-09-01T00:00:00.000Z' }, next: { status: 'archived' }, now, token }), {});
  assert.deepEqual(statusPatch({ prev: { status: 'archived', soldAt: '2026-09-01T00:00:00.000Z' }, next: { status: 'active' }, now, token }), { soldAt: null });
});

test('a new listing always starts clean: no key unless quiet, no sold date unless sold (a clone cannot inherit them)', () => {
  assert.deepEqual(statusPatch({ prev: null, next: { status: 'draft' }, now, token, create: true }), { soldAt: null, privateToken: null });
  assert.deepEqual(statusPatch({ prev: null, next: { status: 'quiet' }, now, token, create: true }), { soldAt: null, privateToken: 'tok123' });
});

test('a listing created as sold is stamped', () => {
  assert.deepEqual(statusPatch({ prev: null, next: { status: 'sold' }, now, token }), { soldAt: now });
});

test('becoming quiet gets a private key; staying quiet keeps it; leaving quiet revokes it', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'draft' }, next: { status: 'quiet' }, now, token }), { privateToken: 'tok123' });
  assert.deepEqual(statusPatch({ prev: { status: 'quiet', privateToken: 'old' }, next: { status: 'quiet' }, now, token }), {});
  assert.deepEqual(statusPatch({ prev: { status: 'quiet', privateToken: 'old' }, next: { status: 'active' }, now, token }), { privateToken: null });
  assert.deepEqual(statusPatch({ prev: null, next: { status: 'quiet' }, now, token }), { privateToken: 'tok123' });
});

test('a quiet listing with no key yet (older row) gets one on its next save', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'quiet', privateToken: null }, next: { status: 'quiet' }, now, token }), { privateToken: 'tok123' });
});

test('a save that does not touch status changes nothing, and nobody can set the key or sold date directly', () => {
  assert.deepEqual(statusPatch({ prev: { status: 'sold' }, next: { title: 'x' }, now, token }), {});
  assert.deepEqual(statusPatch({ prev: { status: 'active' }, next: { status: 'active', privateToken: 'chosen', soldAt: '2020-01-01' }, now, token }), { privateToken: null, soldAt: null });
});
