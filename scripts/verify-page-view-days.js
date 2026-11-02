// Boots this Strapi against a throwaway SQLite file and checks the page-view-day counts end to
// end (back office metrics plan, step 1; TEC-1344): the unique text keys exist, only the
// full-access server token can add, a call is checked, a redelivery adds nothing, a visitor
// counts once per day across deliveries, and deliveries sent together all count. Never touches
// Postgres: it refuses to run when any database setting is present. Run from the repo root:
// node scripts/verify-page-view-days.js
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.join(__dirname, '..');
for (const k of ['DATABASE_URL', 'DATABASE_HOST', 'DATABASE_CLIENT', 'DATABASE_NAME'])
  if (process.env[k]) throw new Error(`${k} is set; this script only runs on a throwaway SQLite file`);
if (fs.existsSync(path.join(root, '.env'))) throw new Error('.env present; run from a checkout without one');

const dbFile = '.tmp/verify-page-view-days.db';
const dbPath = path.join(root, dbFile);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.rmSync(dbPath, { force: true });

const secret = () => crypto.randomBytes(16).toString('base64');
Object.assign(process.env, {
  NODE_ENV: 'development',
  DATABASE_FILENAME: dbFile,
  HOST: '127.0.0.1',
  PORT: process.env.PORT || '1399',
  APP_KEYS: [secret(), secret()].join(','),
  API_TOKEN_SALT: secret(),
  ADMIN_JWT_SECRET: secret(),
  JWT_SECRET: secret(),
  TRANSFER_TOKEN_SALT: secret(),
});

const base = `http://127.0.0.1:${process.env.PORT}/api`;
const T = (n) => n.toString(16).padStart(16, 'a');
const BATCH = (n) => `${String(n).padStart(64, '0')}#0`;
const row = (over = {}) => ({ day: '2026-11-02', dimension: 'path', value: '/for-sale', views: 3, tokens: [T(1), T(2)], ...over });
const post = (token, body) =>
  fetch(`${base}/page-view-days/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

async function main() {
  const createStrapi = require('@strapi/strapi');
  const app = await createStrapi({ appDir: root, distDir: root }).load();
  await app.listen();
  try {
    const knex = app.db.connection;
    for (const table of ['page_view_days', 'page_view_seen', 'page_view_batches']) {
      const indexes = await knex.raw(`PRAGMA index_list('${table}')`);
      const unique = indexes.find((i) => i.name === `${table}_key_unique`);
      assert.ok(unique && unique.unique === 1, `no unique index on ${table}.key: ${JSON.stringify(indexes)}`);
      const cols = await knex.raw(`PRAGMA table_info('${table}')`);
      assert.equal(cols.find((c) => c.name === 'key').type.toLowerCase(), 'text', `${table}.key is not text`);
    }
    console.log('ok  unique text keys on page_view_days, page_view_seen and page_view_batches');

    const tokens = app.service('admin::api-token');
    const full = (await tokens.create({ name: 'verify-full', type: 'full-access', lifespan: null, description: '' })).accessKey;
    const readOnly = (await tokens.create({ name: 'verify-read', type: 'read-only', lifespan: null, description: '' })).accessKey;

    assert.ok([401, 403].includes((await post(null, { batch: BATCH(1), rows: [row()] })).status));
    assert.equal((await post(readOnly, { batch: BATCH(1), rows: [row()] })).status, 403);
    assert.ok([401, 403].includes((await fetch(`${base}/page-view-days`)).status));
    for (const p of ['page-view-seens', 'page-view-batches']) assert.equal((await fetch(`${base}/${p}`, { headers: { Authorization: `Bearer ${full}` } })).status, 404, p);
    console.log('ok  no sign-in, read-only token and public reads are refused; tokens and batches have no routes');

    let res = await post(full, { batch: BATCH(1), rows: [row(), row({ dimension: 'device', value: 'mobile', views: 1, tokens: [T(3)] })] });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { added: 2, repeat: false });
    res = await post(full, { batch: BATCH(1), rows: [row(), row({ dimension: 'device', value: 'mobile', views: 1, tokens: [T(3)] })] });
    assert.deepEqual(await res.json(), { added: 0, repeat: true });
    res = await post(full, { batch: BATCH(2), rows: [row({ views: 4, tokens: [T(1)] })] });
    assert.deepEqual(await res.json(), { added: 1, repeat: false });
    console.log('ok  add creates, a redelivery adds nothing, a new delivery adds views but not a seen visitor');

    assert.equal((await post(full, { batch: BATCH(3), rows: Array.from({ length: 2001 }, (_, i) => row({ value: `/p${i}` })) })).status, 400);
    assert.equal((await post(full, { batch: BATCH(3), rows: [row({ dimension: 'browser' })] })).status, 400);
    assert.equal((await post(full, { rows: [row()] })).status, 400);
    console.log('ok  2,001 rows, a bad dimension and a missing batch key are refused');

    res = await post(full, { batch: BATCH(4), rows: [row({ value: `/${'x'.repeat(400)}`, views: 1, tokens: [T(9)] })] });
    assert.deepEqual(await res.json(), { added: 1, repeat: false });
    console.log('ok  a 400-character path is cut short, not refused');

    await Promise.all(Array.from({ length: 10 }, (_, i) => post(full, { batch: BATCH(100 + i), rows: [row({ value: '/', views: 1, tokens: [T(200 + (i % 3))] })] })));
    const list = await (await fetch(`${base}/page-view-days?pagination[pageSize]=100&sort=key`, { headers: { Authorization: `Bearer ${full}` } })).json();
    const byKey = Object.fromEntries(list.data.map((d) => [d.attributes.key, d.attributes]));
    assert.equal(byKey['2026-11-02|path|/for-sale'].views, 7);
    assert.equal(byKey['2026-11-02|path|/for-sale'].visitors, 2);
    assert.equal(byKey['2026-11-02|path|/for-sale'].day, '2026-11-02');
    assert.equal(byKey['2026-11-02|path|/'].views, 10);
    assert.equal(byKey['2026-11-02|path|/'].visitors, 3);
    assert.equal(byKey['2026-11-02|device|mobile'].views, 1);
    assert.equal(byKey[`2026-11-02|path|/${'x'.repeat(199)}`].views, 1);
    console.log('ok  10 deliveries sent together all count, 3 devices count 3 visitors; server token reads rows back');
    console.log('ALL CHECKS PASSED');
  } finally {
    await app.destroy();
    fs.rmSync(dbPath, { force: true });
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
