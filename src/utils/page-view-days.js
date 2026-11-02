// src/utils/page-view-days.js
'use strict';

// Daily visitor counts from the website's Web Analytics drain (back office metrics plan, step 1;
// TEC-1344). Vercel sends page views to the site in batches; the site counts each batch and
// adds the counts here, one row per Barbados day, dimension and value. No row holds anything
// about a person: no address, no query string, no browser, no session.

const DIMENSIONS = ['path', 'source', 'device', 'country', 'listing'];
const MAX_ROWS = 2000;
const MAX_VALUE = 300;
// Far above any real day on this site; a figure past it means the caller is wrong.
const MAX_COUNT = 1_000_000;
const TABLE = 'page_view_days';
// Rows per INSERT statement: 8 columns each keeps every database well inside its limit on
// bound values.
const CHUNK = 250;

const keyOf = (r) => `${r.day}|${r.dimension}|${r.value}`;

/** A real calendar day written YYYY-MM-DD. */
function isDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isCount = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_COUNT;

/** Why one row is unusable, or null when it is fine. */
function rowProblem(r) {
  if (!r || typeof r !== 'object') return 'not an object';
  if (!isDay(r.day)) return 'day must be YYYY-MM-DD';
  if (!DIMENSIONS.includes(r.dimension)) return `dimension must be one of ${DIMENSIONS.join(', ')}`;
  if (typeof r.value !== 'string' || r.value.length === 0 || r.value.length > MAX_VALUE) return `value must be 1 to ${MAX_VALUE} characters`;
  if (!isCount(r.views)) return 'views must be a whole number from 0';
  if (!isCount(r.visitors)) return 'visitors must be a whole number from 0';
  if (r.visitors > r.views) return 'visitors cannot exceed views';
  return null;
}

/**
 * The rows of a request body, or the reason it is refused. One bad row refuses the whole batch,
 * so a batch is never half added.
 */
function checkRows(body) {
  const rows = body && body.rows;
  if (!Array.isArray(rows)) return { error: 'rows must be a list' };
  if (rows.length > MAX_ROWS) return { error: `at most ${MAX_ROWS} rows per call` };
  for (let i = 0; i < rows.length; i++) {
    const problem = rowProblem(rows[i]);
    if (problem) return { error: `row ${i}: ${problem}` };
  }
  return { rows: rows.map(({ day, dimension, value, views, visitors }) => ({ day, dimension, value, views, visitors })) };
}

/** Rows with the same key added together, first appearance order kept. One INSERT may not touch
    a key twice (Postgres refuses it), so this runs before every add. */
function mergeRows(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    const had = byKey.get(key);
    if (had) {
      had.views += r.views;
      had.visitors += r.visitors;
    } else {
      byKey.set(key, { key, day: r.day, dimension: r.dimension, value: r.value, views: r.views, visitors: r.visitors });
    }
  }
  return [...byKey.values()];
}

/**
 * Add checked rows to the table: a new key is created, an existing key has its views and
 * visitors increased. Each statement is a single INSERT ... ON CONFLICT (key) DO UPDATE, so two
 * batches arriving together both count; the whole call is one transaction. Works on Postgres
 * (Render) and SQLite (local). Returns the number of keys touched.
 */
async function addRows(knex, rows, now = new Date()) {
  const merged = mergeRows(rows);
  if (merged.length === 0) return 0;
  await knex.transaction(async (trx) => {
    for (let i = 0; i < merged.length; i += CHUNK) {
      const chunk = merged.slice(i, i + CHUNK).map((r) => ({ ...r, created_at: now, updated_at: now }));
      await trx(TABLE)
        .insert(chunk)
        .onConflict('key')
        .merge({
          views: trx.raw('??.?? + excluded.??', [TABLE, 'views', 'views']),
          visitors: trx.raw('??.?? + excluded.??', [TABLE, 'visitors', 'visitors']),
          updated_at: now,
        });
    }
  });
  return merged.length;
}

module.exports = { DIMENSIONS, MAX_ROWS, MAX_VALUE, TABLE, keyOf, checkRows, mergeRows, addRows };
