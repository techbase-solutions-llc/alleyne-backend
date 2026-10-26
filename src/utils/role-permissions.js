// src/utils/role-permissions.js
'use strict';

// Permissions granted to the Public (unauthenticated) role.
// Used for content that must be readable without a login.
const PUBLIC_PERMISSIONS = [
  // RealtGuide — publicly readable editorial content
  'api::guide-article.guide-article.find',
  'api::guide-article.guide-article.findOne',
  // Blog articles — publicly readable
  'api::article.article.find',
  'api::article.article.findOne',
  // Agent testimonials — publicly readable
  'api::agent-testimonial.agent-testimonial.find',
  'api::agent-testimonial.agent-testimonial.findOne',
  // (property-submission.create withdrawn, review 8 Oct 2026: the site saves submissions
  // with its server token after its spam checks; the public grant let anyone fill the
  // Submissions inbox straight through the backend, with no check at all.)
];

// The office's notes on listings (session 4, 21 Oct 2026; TEC-1909) are staff only. No role
// holds them: the website reads and writes them with its server token after checking the
// staff member, so a box ticked by mistake in the admin panel is removed on the next boot.
const LISTING_NOTE_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'].map(
  (a) => `api::listing-note.listing-note.${a}`
);

// The office's transaction records (Orna, 23 Oct 2026; TEC-1909): purchasers, prices and
// commission. Office only, exactly as the notes.
const LISTING_TRANSACTION_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'].map(
  (a) => `api::listing-transaction.listing-transaction.${a}`
);

// Public grants that earlier deploys created and that must no longer exist. The grant loop
// only ever adds, so they are deleted on every boot; switching one off in the admin panel
// did not stick before (review, 8 Oct 2026).
const PUBLIC_REVOKED = [
  'api::property-submission.property-submission.create',
  // Resending the confirmation email goes through the site's server token, which has its own
  // per-address limit; the public grant let anyone email any unconfirmed address over and over.
  'plugin::users-permissions.auth.sendEmailConfirmation',
  ...LISTING_NOTE_ACTIONS,
  ...LISTING_TRANSACTION_ACTIONS,
];

/** The permission rows a role holds whose action is on the revoke list. */
function toRevoke(held, revoked) {
  return (held || []).filter((p) => revoked.includes(p.action));
}

// Every action on the notes API, today's five and any added later.
const LISTING_NOTE_PREFIX = 'api::listing-note.listing-note.';

/**
 * Every listing-note grant held by any users-permissions role: Public, Authenticated, the
 * custom roles (Agent, AgencyOwner, AgencyStaff, Host, Moderator) and any role added later.
 * A role's own JWT must never reach the notes; the website uses its server token, which is
 * not a role (TEC-1909). Takes roles with their permissions populated; returns the rows to
 * delete, each with the name of the role that held it.
 */
function listingNoteGrants(roles) {
  return grantsOn(roles, [LISTING_NOTE_PREFIX]);
}

// Every action on the transactions API, today's five and any added later.
const LISTING_TRANSACTION_PREFIX = 'api::listing-transaction.listing-transaction.';

/** As listingNoteGrants, for every office-only API: the notes and the transactions. */
function officeOnlyGrants(roles) {
  return grantsOn(roles, [LISTING_NOTE_PREFIX, LISTING_TRANSACTION_PREFIX]);
}

function grantsOn(roles, prefixes) {
  return (roles || []).flatMap((role) =>
    (role.permissions || [])
      .filter((p) => typeof p.action === 'string' && prefixes.some((x) => p.action.startsWith(x)))
      .map((p) => ({ id: p.id, action: p.action, role: role.name ?? role.type ?? String(role.id) }))
  );
}

module.exports = {
  PUBLIC_PERMISSIONS,
  PUBLIC_REVOKED,
  LISTING_NOTE_ACTIONS,
  LISTING_NOTE_PREFIX,
  LISTING_TRANSACTION_ACTIONS,
  LISTING_TRANSACTION_PREFIX,
  toRevoke,
  listingNoteGrants,
  officeOnlyGrants,
};
