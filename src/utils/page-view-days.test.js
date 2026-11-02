// Daily visitor counts from the website's Web Analytics drain (back office metrics plan, step 1;
// TEC-1344). The site adds each delivery's counts through POST /page-view-days/add; these tests
// cover the checks on what it sends and the add itself, run against real SQLite tables with the
// same unique keys Strapi builds from the schemas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const knexFactory = require("knex");
const {
  MAX_ROWS, MAX_VALUE, KEEP_DAYS, DIMENSIONS, TABLE, SEEN_TABLE, BATCH_TABLE,
  checkRows, keyOf, mergeRows, addRows, barbadosDay,
} = require("./page-view-days");

const T1 = "aaaaaaaaaaaaaaa1";
const T2 = "aaaaaaaaaaaaaaa2";
const T3 = "aaaaaaaaaaaaaaa3";
const BATCH = (n = 1) => `${String(n).padStart(64, "0")}#0`;
const row = (over = {}) => ({ day: "2026-11-02", dimension: "path", value: "/for-sale", views: 3, tokens: [T1, T2], ...over });
const body = (rows, batch = BATCH()) => ({ batch, rows });
// 2 Nov 2026 15:00 UTC = 11:00 in Barbados.
const NOW = new Date(Date.UTC(2026, 10, 2, 15));

test("the limits and tables are the ones the site and schemas use", () => {
  assert.deepEqual(DIMENSIONS, ["path", "source", "device", "country", "listing"]);
  assert.equal(MAX_ROWS, 2000);
  assert.equal(MAX_VALUE, 200);
  assert.equal(KEEP_DAYS, 8);
  assert.equal(TABLE, "page_view_days");
  assert.equal(SEEN_TABLE, "page_view_seen");
  assert.equal(BATCH_TABLE, "page_view_batches");
});

test("the key joins day, dimension and value", () => {
  assert.equal(keyOf(row()), "2026-11-02|path|/for-sale");
});

test("the Barbados day is UTC-4", () => {
  assert.equal(barbadosDay(new Date(Date.UTC(2026, 10, 3, 2))), "2026-11-02");
  assert.equal(barbadosDay(new Date(Date.UTC(2026, 10, 3, 4))), "2026-11-03");
});

test("a good delivery passes, and only the known fields are kept", () => {
  const out = checkRows(body([row({ extra: "x" })]));
  assert.deepEqual(out, { batch: BATCH(), rows: [row()] });
});

test("a delivery without a well formed batch key is refused", () => {
  for (const batch of [undefined, "", "abc", "0".repeat(64), `${"g".repeat(64)}#0`, `${"0".repeat(64)}#12345`])
    assert.ok(checkRows({ batch, rows: [row()] }).error, String(batch));
});

test("a body without a rows list is refused", () => {
  for (const b of [undefined, null, {}, { batch: BATCH(), rows: "x" }, { batch: BATCH(), rows: {} }]) assert.ok(checkRows(b).error, JSON.stringify(b));
});

test("an empty list is fine", () => {
  assert.deepEqual(checkRows(body([])), { batch: BATCH(), rows: [] });
});

test("more than 2,000 rows in one call are refused", () => {
  const rows = Array.from({ length: 2001 }, (_, i) => row({ value: `/p${i}` }));
  assert.match(checkRows(body(rows)).error, /2000/);
  assert.equal(checkRows(body(rows.slice(0, 2000))).rows.length, 2000);
});

test("a bad day, dimension, value, count or token fails the whole delivery", () => {
  const bad = [
    row({ day: "2026-11-2" }),
    row({ day: "2026-02-30" }),
    row({ day: 20261102 }),
    row({ day: "2019-12-31" }),
    row({ day: "2101-01-01" }),
    row({ dimension: "browser" }),
    row({ value: "" }),
    row({ value: 7 }),
    row({ views: -1 }),
    row({ views: 1.5 }),
    row({ views: "3" }),
    row({ views: 1_000_001 }),
    row({ tokens: "x" }),
    row({ tokens: ["xyz"] }),
    row({ tokens: [T1.toUpperCase()] }),
    row({ tokens: [T1, T2, T3, "aaaaaaaaaaaaaaa4"] }),
    null,
  ];
  for (const r of bad) assert.ok(checkRows(body([row(), r])).error, JSON.stringify(r));
  assert.ok(checkRows(body([row({ day: "2020-01-01" }), row({ day: "2100-12-31" })])).rows);
});

test("an over-long value is cut to 200 characters, so one row cannot sink a delivery", () => {
  const out = checkRows(body([row({ value: "x".repeat(400) })]));
  assert.equal(out.rows[0].value, "x".repeat(200));
});

test("repeated tokens in a row count once", () => {
  assert.deepEqual(checkRows(body([row({ tokens: [T1, T1, T2] })])).rows[0].tokens, [T1, T2]);
});

test("rows with the same key are added together, in key order", () => {
  const merged = mergeRows([row({ value: "/z" }), row(), row({ views: 5, tokens: [T2, T3] }), row({ value: "/" })]);
  assert.deepEqual(merged.map((r) => r.key), ["2026-11-02|path|/", "2026-11-02|path|/for-sale", "2026-11-02|path|/z"]);
  assert.deepEqual(merged[1], { key: "2026-11-02|path|/for-sale", day: "2026-11-02", dimension: "path", value: "/for-sale", views: 8, tokens: [T1, T2, T3] });
});

// The tables as Strapi 4 builds them from the schemas: text columns, a unique index on key
// (column.unique), created_at and updated_at.
async function freshDb() {
  const knex = knexFactory({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id");
    t.date("day");
    t.string("dimension");
    t.text("value");
    t.integer("views").defaultTo(0);
    t.integer("visitors").defaultTo(0);
    t.text("key");
    t.datetime("created_at");
    t.datetime("updated_at");
    t.unique(["key"], { indexName: `${TABLE}_key_unique` });
  });
  for (const name of [SEEN_TABLE, BATCH_TABLE]) {
    await knex.schema.createTable(name, (t) => {
      t.increments("id");
      t.date("day");
      t.text("key");
      t.datetime("created_at");
      t.datetime("updated_at");
      t.unique(["key"], { indexName: `${name}_key_unique` });
    });
  }
  return knex;
}

const counts = (knex) => knex(TABLE).select("key", "views", "visitors").orderBy("key");
const add = (knex, rows, batch = BATCH(), now = NOW) => addRows(knex, { batch, rows: checkRows(body(rows, batch)).rows }, now);

test("a delivery creates rows with visitors from the distinct tokens", async () => {
  const knex = await freshDb();
  try {
    assert.deepEqual(await add(knex, [row(), row({ dimension: "device", value: "mobile", views: 1, tokens: [T3] })]), { added: 2, repeat: false });
    assert.deepEqual(await counts(knex), [
      { key: "2026-11-02|device|mobile", views: 1, visitors: 1 },
      { key: "2026-11-02|path|/for-sale", views: 3, visitors: 2 },
    ]);
    const stored = await knex(TABLE).where({ key: "2026-11-02|path|/for-sale" }).first();
    assert.equal(stored.day, "2026-11-02");
    assert.ok(stored.created_at && stored.updated_at);
  } finally {
    await knex.destroy();
  }
});

test("two deliveries from one device on the same day give visitors 1, views 2; a new day counts again", async () => {
  const knex = await freshDb();
  try {
    await add(knex, [row({ views: 1, tokens: [T1] })], BATCH(1));
    await add(knex, [row({ views: 1, tokens: [T1] })], BATCH(2));
    assert.deepEqual(await counts(knex), [{ key: "2026-11-02|path|/for-sale", views: 2, visitors: 1 }]);
    await add(knex, [row({ day: "2026-11-03", views: 1, tokens: [T1] })], BATCH(3));
    assert.deepEqual((await counts(knex))[1], { key: "2026-11-03|path|/for-sale", views: 1, visitors: 1 });
  } finally {
    await knex.destroy();
  }
});

test("the same delivery sent twice counts once", async () => {
  const knex = await freshDb();
  try {
    assert.deepEqual(await add(knex, [row()], BATCH(7)), { added: 1, repeat: false });
    assert.deepEqual(await add(knex, [row()], BATCH(7)), { added: 0, repeat: true });
    assert.deepEqual(await counts(knex), [{ key: "2026-11-02|path|/for-sale", views: 3, visitors: 2 }]);
  } finally {
    await knex.destroy();
  }
});

test("two deliveries at the same moment both count", async () => {
  const knex = await freshDb();
  try {
    await Promise.all([add(knex, [row({ views: 1, tokens: [T1] })], BATCH(1)), add(knex, [row({ views: 2, tokens: [T2] })], BATCH(2))]);
    assert.deepEqual(await counts(knex), [{ key: "2026-11-02|path|/for-sale", views: 3, visitors: 2 }]);
  } finally {
    await knex.destroy();
  }
});

test("a deadlock or serialisation failure is retried, up to twice", async () => {
  const knex = await freshDb();
  try {
    let fails = 2;
    const flaky = (...a) => knex(...a);
    flaky.raw = knex.raw.bind(knex);
    flaky.transaction = async (fn) => {
      if (fails-- > 0) throw Object.assign(new Error("deadlock detected"), { code: fails === 1 ? "40P01" : "40001" });
      return knex.transaction(fn);
    };
    assert.deepEqual(await add(flaky, [row()]), { added: 1, repeat: false });
    assert.equal((await counts(knex))[0].views, 3);

    let always = 0;
    const broken = (...a) => knex(...a);
    broken.raw = knex.raw.bind(knex);
    broken.transaction = async () => {
      always++;
      throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
    };
    await assert.rejects(add(broken, [row()], BATCH(9)), /deadlock/);
    assert.equal(always, 3);

    const other = (...a) => knex(...a);
    other.raw = knex.raw.bind(knex);
    let otherCalls = 0;
    other.transaction = async () => {
      otherCalls++;
      throw Object.assign(new Error("boom"), { code: "23505" });
    };
    await assert.rejects(add(other, [row()], BATCH(10)), /boom/);
    assert.equal(otherCalls, 1);
  } finally {
    await knex.destroy();
  }
});

test("seen tokens and batch keys older than 8 days are cleared; newer ones stay", async () => {
  const knex = await freshDb();
  try {
    const stamp = { created_at: NOW, updated_at: NOW };
    await knex(SEEN_TABLE).insert([
      { day: "2026-10-24", key: `2026-10-24|path|/|${T1}`, ...stamp },
      { day: "2026-10-25", key: `2026-10-25|path|/|${T1}`, ...stamp },
    ]);
    await knex(BATCH_TABLE).insert([
      { day: "2026-10-24", key: BATCH(50), ...stamp },
      { day: "2026-10-25", key: BATCH(51), ...stamp },
    ]);
    await add(knex, [row()], BATCH(1));
    const seenDays = (await knex(SEEN_TABLE).select("day")).map((r) => r.day);
    assert.ok(!seenDays.includes("2026-10-24"));
    assert.ok(seenDays.includes("2026-10-25"));
    const batches = (await knex(BATCH_TABLE).select("key")).map((r) => r.key);
    assert.deepEqual(batches.sort(), [BATCH(1), BATCH(51)].sort());
  } finally {
    await knex.destroy();
  }
});

test("a delivery bigger than one insert statement is added in full", async () => {
  const knex = await freshDb();
  try {
    const rows = Array.from({ length: 2000 }, (_, i) => row({ value: `/p${i}`, views: 2, tokens: [T1, T2] }));
    assert.deepEqual(await add(knex, rows), { added: 2000, repeat: false });
    assert.equal((await knex(TABLE).count({ n: "*" }))[0].n, 2000);
    assert.equal((await knex(SEEN_TABLE).count({ n: "*" }))[0].n, 4000);
    assert.equal((await knex(TABLE).sum({ v: "visitors" }))[0].v, 4000);
  } finally {
    await knex.destroy();
  }
});

test("an empty delivery is still recorded, so its repeat is recognised", async () => {
  const knex = await freshDb();
  try {
    assert.deepEqual(await add(knex, []), { added: 0, repeat: false });
    assert.deepEqual(await add(knex, []), { added: 0, repeat: true });
    assert.deepEqual(await counts(knex), []);
  } finally {
    await knex.destroy();
  }
});
