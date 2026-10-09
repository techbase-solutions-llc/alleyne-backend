'use strict';

// What a signed-in user may write to their own saved search (TEC-1343 review): name,
// filters and the alert switch, trimmed and bounded. Never user or lastAlertedAt.
// Control characters (0-31, 127) are replaced before a name can reach an email subject.
const CONTROL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
const clean = (body) => {
  const out = {};
  if (typeof body.name === 'string') out.name = body.name.replace(CONTROL, ' ').trim().slice(0, 250);
  if (body.filtersJson && typeof body.filtersJson === 'object' && typeof body.filtersJson.query === 'string' && body.filtersJson.query.length <= 4000) {
    out.filtersJson = { query: body.filtersJson.query, summary: String(body.filtersJson.summary ?? '').slice(0, 250) };
  }
  if (typeof body.alertEnabled === 'boolean') out.alertEnabled = body.alertEnabled;
  return out;
};

// The account the site's stop-alerts link names (review, 8 Oct 2026): a whole positive
// number or nothing, never a query object.
const userIdOf = (body) => {
  const v = body && body.userId;
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

module.exports = { clean, userIdOf };
