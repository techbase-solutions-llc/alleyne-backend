'use strict';
// The sender for the old Realtlist source-sync notice (27 Oct): the backend's own settings, or
// null so nothing is sent. It used to fall back to noreply@realtlist.com.
function legacySyncSender(env) {
  const v = (env && (env.RESEND_FROM_EMAIL || env.EMAIL_FROM)) || '';
  return v.trim() || null;
}

module.exports = { legacySyncSender };
