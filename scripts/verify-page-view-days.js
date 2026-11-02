// Boots this Strapi against a throwaway SQLite file and checks the page-view-day counts end to
// end (back office metrics plan, step 1; TEC-1344): the unique index on key exists, only the
// full-access server token can add, a batch is checked, counts add up, and two batches sent
// together both count. Never touches Postgres: it refuses to run when any database setting
// is present. Run from the repo root: node scripts/verify-page-view-days.js
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
const row = (over = {}) => ({ day: '2026-11-02', dimension: 'path', value: '/for-sale', views: 3, visitors: 2, ...over });
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
    const indexes = await knex.raw("PRAGMA index_list('page_view_days')");
    const unique = indexes.find((i) => i.name === 'page_view_days_key_unique');
    assert.ok(unique && unique.unique === 1, `no unique index on key: ${JSON.stringify(indexes)}`);
    console.log('ok  unique index page_view_days_key_unique');

    const tokens = app.service('admin::api-token');
    const full = (await tokens.create({ name: 'verify-full', type: 'full-access', lifespan: null, description: '' })).accessKey;
    const readOnly = (await tokens.create({ name: 'verify-read', type: 'read-only', lifespan: null, description: '' })).accessKey;

    assert.ok([401, 403].includes((await post(null, { rows: [row()] })).status));
    assert.equal((await post(readOnly, { rows: [row()] })).status, 403);
    assert.ok([401, 403].includes((await fetch(`${base}/page-view-days`)).status));
    console.log('ok  no sign-in, read-only token and public reads are refused');

    let res = await post(full, { rows: [row(), row({ dimension: 'device', value: 'mobile', views: 1, visitors: 1 })] });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { added: 2 });
    res = await post(full, { rows: [row({ views: 4, visitors: 1 })] });
    assert.deepEqual(await res.json(), { added: 1 });
    console.log('ok  add creates, then increases');

    assert.equal((await post(full, { rows: Array.from({ length: 2001 }, (_, i) => row({ value: `/p${i}` })) })).status, 400);
    assert.equal((await post(full, { rows: [row({ dimension: 'browser' })] })).status, 400);
    console.log('ok  2,001 rows and a bad dimension are refused');

    await Promise.all(Array.from({ length: 10 }, () => post(full, { rows: [row({ value: '/', views: 1, visitors: 1 })] })));
    const list = await (await fetch(`${base}/page-view-days?pagination[pageSize]=100&sort=key`, { headers: { Authorization: `Bearer ${full}` } })).json();
    const byKey = Object.fromEntries(list.data.map((d) => [d.attributes.key, d.attributes]));
    assert.equal(byKey['2026-11-02|path|/for-sale'].views, 7);
    assert.equal(byKey['2026-11-02|path|/for-sale'].visitors, 3);
    assert.equal(byKey['2026-11-02|path|/for-sale'].day, '2026-11-02');
    assert.equal(byKey['2026-11-02|path|/'].views, 10);
    assert.equal(byKey['2026-11-02|device|mobile'].views, 1);
    console.log('ok  10 batches sent together all count; server token reads the rows back');
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
