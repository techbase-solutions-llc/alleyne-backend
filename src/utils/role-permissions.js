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

// Website feedback (site feedback plan, 3 Nov 2026): visitors' reports, their email addresses
// and the office's notes on them. The site saves them with its server token after its own checks
// and the back office reads and handles them with it; no role creates, reads, changes or deletes
// them, exactly as the notes.
const SITE_FEEDBACK_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'].map(
  (a) => `api::site-feedback.site-feedback.${a}`
);

// Client accounts (client accounts plan, 5 Nov 2026): the office's record of what staff did to
// each client's account, and one account's private consent fields. The website writes and reads
// both with its server token after checking the staff member's permission; no role holds them.
const CLIENT_ACTION_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'].map(
  (a) => `api::client-action.client-action.${a}`
);
const CLIENT_CONSENT_ACTIONS = ['api::client-consent.client-consent.findOne'];
// One client's saved properties and searches for the client page (plan section 2), likewise.
const CLIENT_SAVED_ACTIONS = ['api::client-saved.client-saved.findOne'];

// Journal posts (journal publishing plan, 7 Nov 2026; TEC-2138): drafts, posts ready for review,
// scheduled and published posts. The website reads them and the back office writes, publishes and
// schedules them with the server token, after checking the staff member's journal permission; no
// role holds them, so a draft or a scheduled post never shows before its time.
const JOURNAL_POST_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'].map(
  (a) => `api::journal-post.journal-post.${a}`
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
  ...SITE_FEEDBACK_ACTIONS,
  ...CLIENT_ACTION_ACTIONS,
  ...CLIENT_CONSENT_ACTIONS,
  ...CLIENT_SAVED_ACTIONS,
  ...JOURNAL_POST_ACTIONS,
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

// Daily visitor counts from the website's analytics drain (back office metrics, TEC-1344).
// Written and read by the website's server token only, exactly as the notes.
const PAGE_VIEW_DAY_PREFIX = 'api::page-view-day.page-view-day.';
// Its visitor tokens and delivery keys have no routes at all; any grant is still removed.
const PAGE_VIEW_SEEN_PREFIX = 'api::page-view-seen.page-view-seen.';
const PAGE_VIEW_BATCH_PREFIX = 'api::page-view-batch.page-view-batch.';
// Website feedback, every action today and any added later.
const SITE_FEEDBACK_PREFIX = 'api::site-feedback.site-feedback.';
// The client action history and the consent endpoint, every action today and any added later.
const CLIENT_ACTION_PREFIX = 'api::client-action.client-action.';
const CLIENT_CONSENT_PREFIX = 'api::client-consent.client-consent.';
const CLIENT_SAVED_PREFIX = 'api::client-saved.client-saved.';
// Journal posts, every action today and any added later.
const JOURNAL_POST_PREFIX = 'api::journal-post.journal-post.';

/** As listingNoteGrants, for every office-only API: the notes, the transactions, the daily
    visitor counts with their tokens and delivery keys, the website feedback, the client
    action history, the consent endpoint and the saved-things endpoint, and the journal posts. */
function officeOnlyGrants(roles) {
  return grantsOn(roles, [LISTING_NOTE_PREFIX, LISTING_TRANSACTION_PREFIX, PAGE_VIEW_DAY_PREFIX, PAGE_VIEW_SEEN_PREFIX, PAGE_VIEW_BATCH_PREFIX, SITE_FEEDBACK_PREFIX, CLIENT_ACTION_PREFIX, CLIENT_CONSENT_PREFIX, CLIENT_SAVED_PREFIX, JOURNAL_POST_PREFIX]);
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
  PAGE_VIEW_DAY_PREFIX,
  SITE_FEEDBACK_ACTIONS,
  SITE_FEEDBACK_PREFIX,
  CLIENT_ACTION_ACTIONS,
  CLIENT_ACTION_PREFIX,
  CLIENT_CONSENT_ACTIONS,
  CLIENT_CONSENT_PREFIX,
  CLIENT_SAVED_ACTIONS,
  CLIENT_SAVED_PREFIX,
  JOURNAL_POST_ACTIONS,
  JOURNAL_POST_PREFIX,
  toRevoke,
  listingNoteGrants,
  officeOnlyGrants,
};
