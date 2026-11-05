'use strict';
// One client account's consent record for the office's client page (client accounts plan,
// 5 Nov 2026, section 5). The fields are private on the user type, so no API answer carries them;
// GET /api/client-consents/:userId gives them to the website's full-access server token and to
// nothing else. No role holds the route (src/utils/role-permissions.js) and the route's policy
// refuses any request that is not that token, so a JWT of any role gets 403 either way.
const { isServerToken } = require('./favourite-token-list');

const CONSENT_FIELDS = [
  'marketingOptIn',
  'marketingOptInAt',
  'marketingConsentText',
  'marketingConsentVersion',
  'marketingConsentSource',
  'marketingOptOutAt',
  'marketingOptOutSource',
];

/** The website's full-access server token, with no signed-in user on the request. */
const serverTokenOnly = (ctx) => !ctx?.state?.user && isServerToken(ctx);

/** A positive whole-number account id from the path, or null. */
function parseUserId(raw) {
  const s = typeof raw === 'number' ? String(raw) : raw;
  if (typeof s !== 'string' || !/^[1-9][0-9]{0,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** The seven consent fields of a user row, and nothing else. */
function consentFields(row) {
  const out = {};
  for (const f of CONSENT_FIELDS) out[f] = f === 'marketingOptIn' ? Boolean(row?.[f]) : row?.[f] ?? null;
  return out;
}

/** The consent of one account, or null when the id is malformed or has no account. */
async function readConsent(db, rawId) {
  const id = parseUserId(rawId);
  if (!id) return null;
  const row = await db.query('plugin::users-permissions.user').findOne({ where: { id }, select: CONSENT_FIELDS });
  return row ? consentFields(row) : null;
}

module.exports = { CONSENT_FIELDS, serverTokenOnly, parseUserId, consentFields, readConsent };
