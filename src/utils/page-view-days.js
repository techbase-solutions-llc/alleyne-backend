// src/utils/page-view-days.js
'use strict';

// Daily visitor counts from the website's Web Analytics drain (back office metrics plan, step 1;
// TEC-1344). Vercel delivers page views to the site; the site counts each delivery and adds the
// counts here, one row per Barbados day, dimension and value. No row holds anything about a
// person: no address, query string, browser or device id.
//
// Visitors: for each row the site sends opaque visitor tokens (an HMAC of the day and Vercel's
// device id under the drain secret, cut to 16 hex characters). Every day|dimension|value|token
// seen is kept for KEEP_DAYS in page_view_seen, and a row's visitors grow only by the tokens not
// seen before, so one person on one day counts once however many deliveries carry them.
//
// Redelivery: each call carries a batch key (sha256 of the delivery body and the part number).
// Keys are kept for KEEP_DAYS in page_view_batches; a key already there is answered as done and
// adds nothing, so Vercel may safely deliver the same body again after a failure.

const DIMENSIONS = ['path', 'source', 'device', 'country', 'listing'];
const MAX_ROWS = 2000;
// The site cuts values to the same length. The columns are text, so nothing overflows.
const MAX_VALUE = 200;
// Far above any real day on this site; a figure past it means the caller is wrong.
const MAX_COUNT = 1_000_000;
// The site counts events up to 7 days old; tokens and batch keys outlive that by a day.
const KEEP_DAYS = 8;
const TABLE = 'page_view_days';
const SEEN_TABLE = 'page_view_seen';
const BATCH_TABLE = 'page_view_batches';
// Rows per INSERT statement, well inside every database's limit on bound values.
const CHUNK = 250;
// Deadlock (40P01) and serialisation failure (40001) on Postgres: safe to run again.
const RETRY_CODES = new Set(['40P01', '40001']);
const RETRIES = 2;
const BARBADOS_OFFSET_MS = 4 * 60 * 60 * 1000;

const TOKEN = /^[0-9a-f]{16}$/;
const BATCH = /^[0-9a-f]{64}#\d{1,4}$/;

const keyOf = (r) => `${r.day}|${r.dimension}|${r.value}`;

const CONTROL = /[\u0000-\u001f\u007f]/g;
const LONE_SURROGATE = /^[\uD800-\uDFFF]$/;

/** A value fit to store, the same rule as the site's cleanValue (src/lib/analytics-drain.ts):
    no control characters (Postgres text cannot hold NUL), no lone surrogate halves (Postgres
    stores them as U+FFFD, so keys stopped matching), at most 200 whole characters. */
function cleanValue(v) {
  return Array.from(v.replace(CONTROL, ''))
    .filter((ch) => !LONE_SURROGATE.test(ch))
    .slice(0, MAX_VALUE)
    .join('');
}

/** The Barbados calendar day (UTC-4 all year) of a moment. */
const barbadosDay = (date) => new Date(date.getTime() - BARBADOS_OFFSET_MS).toISOString().slice(0, 10);

/** A real calendar day from 2020 to 2100 written YYYY-MM-DD. */
function isDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const year = Number(v.slice(0, 4));
  if (year < 2020 || year > 2100) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isCount = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_COUNT;

/** Why one row is unusable, or null when it is fine. */
function rowProblem(r) {
  if (!r || typeof r !== 'object') return 'not an object';
  if (!isDay(r.day)) return 'day must be YYYY-MM-DD, 2020 to 2100';
  if (!DIMENSIONS.includes(r.dimension)) return `dimension must be one of ${DIMENSIONS.join(', ')}`;
  if (typeof r.value !== 'string' || r.value.length === 0) return 'value must be text';
  if (!isCount(r.views)) return 'views must be a whole number from 0';
  if (!Array.isArray(r.tokens) || !r.tokens.every((t) => typeof t === 'string' && TOKEN.test(t))) return 'tokens must be 16 lower-case hex characters each';
  if (new Set(r.tokens).size > r.views) return 'more visitors than views';
  return null;
}

/**
 * The batch key and rows of a request body, or the reason it is refused. One malformed row
 * refuses the whole call, so a call is never half added. Values are cleaned (cleanValue): an
 * over-long one is cut short, and a row whose value is empty once cleaned is dropped.
 */
function checkRows(body) {
  const batch = body && body.batch;
  if (typeof batch !== 'string' || !BATCH.test(batch)) return { error: 'batch must be a sha256 hex digest and a part number' };
  const rows = body.rows;
  if (!Array.isArray(rows)) return { error: 'rows must be a list' };
  if (rows.length > MAX_ROWS) return { error: `at most ${MAX_ROWS} rows per call` };
  for (let i = 0; i < rows.length; i++) {
    const problem = rowProblem(rows[i]);
    if (problem) return { error: `row ${i}: ${problem}` };
  }
  return {
    batch,
    rows: rows
      .map(({ day, dimension, value, views, tokens }) => ({
        day, dimension, value: cleanValue(value), views, tokens: [...new Set(tokens)],
      }))
      .filter((r) => r.value.length > 0),
  };
}

/** Rows with the same key added together, sorted by key. One INSERT may not touch a key twice
    (Postgres refuses it), and every call taking its row locks in key order means two calls
    cannot wait on each other in a circle. Keyed on the cleaned value, the text actually stored,
    so two values that clean to the same text are one row here (review, 2 Nov 2026). */
function mergeRows(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const value = cleanValue(r.value);
    if (!value) continue;
    const key = keyOf({ ...r, value });
    const had = byKey.get(key);
    if (had) {
      had.views += r.views;
      for (const t of r.tokens) if (!had.tokens.includes(t)) had.tokens.push(t);
    } else {
      byKey.set(key, { key, day: r.day, dimension: r.dimension, value, views: r.views, tokens: [...r.tokens] });
    }
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const chunks = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
};

/** The day KEEP_DAYS before `now`'s Barbados day; seen tokens and batch keys before it go. */
function cutoffDay(now) {
  const d = new Date(`${barbadosDay(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - KEEP_DAYS);
  return d.toISOString().slice(0, 10);
}

async function addOnce(knex, batch, merged, now) {
  return knex.transaction(async (trx) => {
    const stamp = { created_at: now, updated_at: now };
    // The batch key first: a repeat stops here having changed nothing.
    const fresh = await trx(BATCH_TABLE).insert({ key: batch, day: barbadosDay(now), ...stamp }).onConflict('key').ignore().returning('key');
    if (fresh.length === 0) return { added: 0, repeat: true };

    // Tokens not seen before for each row, inserted in key order.
    const seen = merged
      .flatMap((r) => r.tokens.map((t) => ({ key: `${r.key}|${t}`, day: r.day, ...stamp })))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const newVisitors = new Map();
    for (const part of chunks(seen)) {
      const inserted = await trx(SEEN_TABLE).insert(part).onConflict('key').ignore().returning('key');
      for (const r of inserted) {
        const k = typeof r === 'string' ? r : r.key;
        const rowKey = k.slice(0, k.lastIndexOf('|'));
        newVisitors.set(rowKey, (newVisitors.get(rowKey) || 0) + 1);
      }
    }

    for (const part of chunks(merged)) {
      const data = part.map((r) => ({
        key: r.key, day: r.day, dimension: r.dimension, value: r.value,
        views: r.views, visitors: newVisitors.get(r.key) || 0, ...stamp,
      }));
      await trx(TABLE)
        .insert(data)
        .onConflict('key')
        .merge({
          views: trx.raw('??.?? + excluded.??', [TABLE, 'views', 'views']),
          visitors: trx.raw('??.?? + excluded.??', [TABLE, 'visitors', 'visitors']),
          updated_at: now,
        });
    }
    return { added: merged.length, repeat: false };
  });
}

/**
 * Add one checked call ({ batch, rows }) to the tables: views are added, visitors grow by the
 * tokens not seen before, and a batch key already recorded adds nothing. One transaction,
 * retried up to twice on a deadlock or serialisation failure. Old tokens and batch keys are
 * cleared afterwards, outside the transaction; a failure there is ignored. Works on Postgres
 * (Render) and SQLite (local). Returns { added, repeat }.
 */
async function addRows(knex, { batch, rows }, now = new Date()) {
  const merged = mergeRows(rows);
  let result;
  for (let attempt = 0; ; attempt++) {
    try {
      result = await addOnce(knex, batch, merged, now);
      break;
    } catch (e) {
      if (attempt < RETRIES && e && RETRY_CODES.has(e.code)) continue;
      throw e;
    }
  }
  const cutoff = cutoffDay(now);
  try {
    await knex(SEEN_TABLE).where('day', '<', cutoff).del();
    await knex(BATCH_TABLE).where('day', '<', cutoff).del();
  } catch {
    // Clearing is housekeeping; the next call tries again.
  }
  return result;
}

module.exports = {
  DIMENSIONS, MAX_ROWS, MAX_VALUE, KEEP_DAYS, TABLE, SEEN_TABLE, BATCH_TABLE,
  keyOf, barbadosDay, cleanValue, checkRows, mergeRows, addRows,
};
