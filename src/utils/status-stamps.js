'use strict';

// Fields the backend owns when a listing's status changes (TEC-1412, 29 Sep walkthrough):
// - soldAt: when it became sold. The site keeps sold listings visible with a Sold banner
//   for a period, then its daily maintenance archives them (never deletes).
// - privateToken: the key in a quiet listing's private link. Made when the listing becomes
//   quiet, removed when it stops being quiet (so an old link stops working).
// Neither can be set by a caller: whatever the save sends for them is replaced here.

const crypto = require('crypto');

const newToken = () => crypto.randomBytes(18).toString('base64url');

/**
 * prev: the stored row (null on create). next: the incoming data, where an absent status
 * means "unchanged". Returns the fields to write alongside the save ({} = nothing).
 */
function statusPatch({ prev, next, now, token = newToken, create = false }) {
  const before = prev || {};
  const out = {};
  const callerSet = 'privateToken' in next || 'soldAt' in next;
  if (next.status === undefined && !callerSet && !create) return out;
  const status = next.status !== undefined ? next.status : before.status;

  if (status === 'sold') {
    if (before.status !== 'sold' || !before.soldAt) out.soldAt = now;
    else if ('soldAt' in next) out.soldAt = before.soldAt;
  } else if (status === 'archived' && before.soldAt) {
    // Archived after its Sold banner period: keep when it sold, as history.
    if ('soldAt' in next) out.soldAt = before.soldAt;
  } else if (before.soldAt || 'soldAt' in next || create) {
    out.soldAt = null;
  }

  if (status === 'quiet') {
    if (!before.privateToken) out.privateToken = token();
    else if ('privateToken' in next) out.privateToken = before.privateToken;
  } else if (before.privateToken || 'privateToken' in next || create) {
    out.privateToken = null;
  }
  return out;
}

module.exports = { statusPatch };
