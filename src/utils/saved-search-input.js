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

// A team member's label on a search saved for a client (8 Oct 2026 meeting): the client's
// name and an optional note, one line each (the name goes into the alert email's subject).
// Only the fields sent are returned; an empty name clears the label and its note. The
// controller keeps these for active team members only.
const oneLine = (v, max) => v.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const clientLabel = (body) => {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  if (typeof body.clientName === 'string') out.clientName = oneLine(body.clientName, 80) || null;
  if (typeof body.clientNote === 'string') out.clientNote = oneLine(body.clientNote, 300) || null;
  if (out.clientName === null && 'clientNote' in out) out.clientNote = null;
  return out;
};

// How many saved searches an account may keep. The cap of 20 stops an account made with
// someone else's address from flooding them with alerts (TEC-1343 review). A team member
// saves searches for their clients as well as their own (8 Oct meeting), so theirs is 200.
const searchLimit = (teamMember) => (teamMember ? 200 : 20);

module.exports = { clean, userIdOf, clientLabel, searchLimit };
