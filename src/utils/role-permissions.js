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

// Public grants that earlier deploys created and that must no longer exist. The grant loop
// only ever adds, so they are deleted on every boot; switching one off in the admin panel
// did not stick before (review, 8 Oct 2026).
const PUBLIC_REVOKED = [
  'api::property-submission.property-submission.create',
  // Resending the confirmation email goes through the site's server token, which has its own
  // per-address limit; the public grant let anyone email any unconfirmed address over and over.
  'plugin::users-permissions.auth.sendEmailConfirmation',
];

/** The permission rows a role holds whose action is on the revoke list. */
function toRevoke(held, revoked) {
  return (held || []).filter((p) => revoked.includes(p.action));
}

module.exports = { PUBLIC_PERMISSIONS, PUBLIC_REVOKED, toRevoke };
