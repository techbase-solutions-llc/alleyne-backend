// Daily visitor counts from the website's Web Analytics drain (back office metrics plan, step 1;
// TEC-1344). The site adds each batch's counts through POST /page-view-days/add; these tests
// cover the checks on what it sends and the add itself, run against a real SQLite table with
// the same unique key Strapi builds from the schema.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const knexFactory = require("knex");
const { MAX_ROWS, DIMENSIONS, TABLE, checkRows, keyOf, mergeRows, addRows } = require("./page-view-days");

const row = (over = {}) => ({ day: "2026-11-02", dimension: "path", value: "/for-sale", views: 3, visitors: 2, ...over });

test("the dimensions are the five the drain records", () => {
  assert.deepEqual(DIMENSIONS, ["path", "source", "device", "country", "listing"]);
  assert.equal(MAX_ROWS, 2000);
  assert.equal(TABLE, "page_view_days");
});

test("the key joins day, dimension and value", () => {
  assert.equal(keyOf(row()), "2026-11-02|path|/for-sale");
});

test("a good batch passes, and only the five fields are kept", () => {
  const out = checkRows({ rows: [row({ extra: "x" })] });
  assert.deepEqual(out, { rows: [row()] });
});

test("a body without a rows list is refused", () => {
  for (const body of [undefined, null, {}, { rows: "x" }, { rows: {} }]) assert.ok(checkRows(body).error, JSON.stringify(body));
});

test("an empty list is fine and adds nothing", () => {
  assert.deepEqual(checkRows({ rows: [] }), { rows: [] });
});

test("more than 2,000 rows in one call are refused", () => {
  const rows = Array.from({ length: 2001 }, (_, i) => row({ value: `/p${i}` }));
  assert.match(checkRows({ rows }).error, /2000/);
  assert.equal(checkRows({ rows: rows.slice(0, 2000) }).rows.length, 2000);
});

test("a bad day, dimension, value or count fails the whole batch", () => {
  const bad = [
    row({ day: "2026-11-2" }),
    row({ day: "2026-02-30" }),
    row({ day: 20261102 }),
    row({ dimension: "browser" }),
    row({ value: "" }),
    row({ value: "x".repeat(301) }),
    row({ value: 7 }),
    row({ views: -1 }),
    row({ views: 1.5 }),
    row({ views: "3" }),
    row({ visitors: -1 }),
    row({ visitors: 4, views: 3 }),
    row({ views: 1_000_001 }),
    null,
  ];
  for (const r of bad) assert.ok(checkRows({ rows: [row(), r] }).error, JSON.stringify(r));
  assert.ok(checkRows({ rows: [row({ value: "x".repeat(300) })] }).rows);
});

test("rows with the same key in one call are added together first", () => {
  const merged = mergeRows([row(), row({ views: 5, visitors: 1 }), row({ value: "/" })]);
  assert.deepEqual(merged, [
    { key: "2026-11-02|path|/for-sale", day: "2026-11-02", dimension: "path", value: "/for-sale", views: 8, visitors: 3 },
    { key: "2026-11-02|path|/", day: "2026-11-02", dimension: "path", value: "/", views: 3, visitors: 2 },
  ]);
});

// The table as Strapi 4 builds it from schema.json: a unique index on key
// (column.unique), created_at and updated_at.
async function freshDb() {
  const knex = knexFactory({ client: "better-sqlite3", connection: { filename: ":memory:" }, useNullAsDefault: true });
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id");
    t.date("day");
    t.string("dimension");
    t.string("value");
    t.integer("views").defaultTo(0);
    t.integer("visitors").defaultTo(0);
    t.string("key");
    t.datetime("created_at");
    t.datetime("updated_at");
    t.unique(["key"], { indexName: `${TABLE}_key_unique` });
  });
  return knex;
}

const all = (knex) => knex(TABLE).select("key", "views", "visitors").orderBy("key");

test("adding creates a row for a new key and adds to an existing one", async () => {
  const knex = await freshDb();
  try {
    assert.equal(await addRows(knex, [row(), row({ dimension: "device", value: "mobile", views: 1, visitors: 1 })]), 2);
    assert.equal(await addRows(knex, [row({ views: 4, visitors: 1 })]), 1);
    assert.deepEqual(await all(knex), [
      { key: "2026-11-02|device|mobile", views: 1, visitors: 1 },
      { key: "2026-11-02|path|/for-sale", views: 7, visitors: 3 },
    ]);
    const stored = await knex(TABLE).where({ key: "2026-11-02|path|/for-sale" }).first();
    assert.equal(stored.day, "2026-11-02");
    assert.equal(stored.dimension, "path");
    assert.equal(stored.value, "/for-sale");
    assert.ok(stored.created_at && stored.updated_at);
  } finally {
    await knex.destroy();
  }
});

test("two adds at the same moment both count", async () => {
  const knex = await freshDb();
  try {
    await Promise.all([addRows(knex, [row({ views: 1, visitors: 1 })]), addRows(knex, [row({ views: 2, visitors: 1 })])]);
    assert.deepEqual(await all(knex), [{ key: "2026-11-02|path|/for-sale", views: 3, visitors: 2 }]);
  } finally {
    await knex.destroy();
  }
});

test("a batch bigger than one insert statement is added in full", async () => {
  const knex = await freshDb();
  try {
    const rows = Array.from({ length: 2000 }, (_, i) => row({ value: `/p${i}`, views: 1, visitors: 1 }));
    assert.equal(await addRows(knex, rows), 2000);
    assert.equal((await knex(TABLE).count({ n: "*" }))[0].n, 2000);
  } finally {
    await knex.destroy();
  }
});

test("adding nothing touches nothing", async () => {
  const knex = await freshDb();
  try {
    assert.equal(await addRows(knex, []), 0);
    assert.deepEqual(await all(knex), []);
  } finally {
    await knex.destroy();
  }
});
