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
  // Property submission — public users can submit without an account
  'api::property-submission.property-submission.create',
];

const AUTHENTICATED_PERMISSIONS = [
  // Signed-in users are the agency's clients (TEC-1343 review). Everything agents do
  // (listings, rooms, availability, sources and imports, the agency, its members and
  // invites) goes through the site's server token after the site checks agency
  // membership. The multi-agency grants inherited from Realtlist let any sign-up edit or
  // delete agency memberships and change the agency; they are revoked below.
  // Leads — create only. Reading and updating leads (visitor names, emails, phones,
  // messages) is done by the site's server token for agency members; a signed-in
  // user's own JWT must not reach them (TEC-1239 review: open sign-up exposed them).
  // (lead.create and reservation.create withdrawn: the site creates both with its server
  // token after its spam checks; a direct create let any account plant leads or
  // confirmed bookings in the back office. TEC-1343 second review.)
  // Favourites — authenticated users only. find is scoped to the user by the controller;
  // findOne is not granted: it was not scoped, so any signed-in user could read anyone's
  // row by id (TEC-1273 review). The site never reads a single row.
  'api::favorite.favorite.find',
  'api::favorite.favorite.create',
  'api::favorite.favorite.delete',
  // Saved searches — authenticated users only (findOne withheld, as above)
  'api::saved-search.saved-search.find',
  'api::saved-search.saved-search.create',
  'api::saved-search.saved-search.update',
  'api::saved-search.saved-search.delete',
  // Reservations — create only; reads/updates go through the site's server token
  // (same reason as leads above).
  // Users-permissions
  'plugin::users-permissions.auth.connect',
  'plugin::users-permissions.user.me',
];

/**
 * Repair missing users-permissions columns in up_users and create the
 * up_users_role_links junction table if absent.
 * Idempotent — uses IF NOT EXISTS. Safe to run on every startup.
 */
async function repairUpUserSchema(strapi) {
  const knex = strapi.db.connection;

  // 1. Patch missing core columns on up_users
  const missingCols = [
    { col: 'username',               sql: "ADD COLUMN IF NOT EXISTS username varchar(255)" },
    { col: 'email',                  sql: "ADD COLUMN IF NOT EXISTS email varchar(255)" },
    { col: 'provider',               sql: "ADD COLUMN IF NOT EXISTS provider varchar(255) DEFAULT 'local'" },
    { col: 'password',               sql: "ADD COLUMN IF NOT EXISTS password varchar(255)" },
    { col: 'reset_password_token',   sql: "ADD COLUMN IF NOT EXISTS reset_password_token varchar(255)" },
    { col: 'confirmation_token',     sql: "ADD COLUMN IF NOT EXISTS confirmation_token varchar(255)" },
    { col: 'confirmed',              sql: "ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT false" },
    { col: 'blocked',                sql: "ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false" },
  ];

  for (const { col, sql } of missingCols) {
    try {
      await knex.raw(`ALTER TABLE up_users ${sql}`);
      strapi.log.info(`[repair] up_users.${col} — ensured`);
    } catch (e) {
      strapi.log.warn(`[repair] up_users.${col} — skipped: ${e.message}`);
    }
  }

  // 2. Ensure up_users_role_links exists. Strapi's migration creates it, but if
  //    the table was ever dropped (e.g., to fix a conflict), Strapi won't recreate
  //    it because the migration is already marked as run.
  try {
    const hasRoleLinks = await knex.schema.hasTable('up_users_role_links');
    if (!hasRoleLinks) {
      await knex.schema.createTable('up_users_role_links', (t) => {
        t.increments('id').primary();
        t.integer('user_id').unsigned().references('id').inTable('up_users').onDelete('CASCADE');
        t.integer('role_id').unsigned().references('id').inTable('up_roles').onDelete('CASCADE');
        t.float('user_order').defaultTo(null);
      });
      strapi.log.info('[repair] created up_users_role_links');
    }
  } catch (e) {
    strapi.log.warn('[repair] up_users_role_links repair skipped:', e.message);
  }

  // 3. Drop any plain unique indexes (best-effort) — preMigrationCleanup handles
  //    this before migrations, but run again here as a safety net.
  try {
    await knex.raw('DROP INDEX IF EXISTS up_users_username_unique');
    await knex.raw('DROP INDEX IF EXISTS up_users_email_unique');
  } catch { /* ignore */ }
}

/**
 * Pre-migration DB cleanup using a direct pg connection.
 * Ensures Strapi's own migrations can run cleanly by:
 *   1. Creating any missing named constraints (so DROP CONSTRAINT succeeds)
 *   2. Dropping any manually-created tables that Strapi needs to own
 */
async function preMigrationCleanup(strapi) {
  const { Client } = require('pg');
  const client = new Client({
    host:     process.env.DATABASE_HOST,
    port:     parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME,
    user:     process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    ssl:      process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    // 1. Drop any plain indexes that conflict with Strapi's constraint-based migration
    await client.query('DROP INDEX IF EXISTS up_users_username_unique');
    await client.query('DROP INDEX IF EXISTS up_users_email_unique');
    strapi.log.info('[register] dropped plain unique indexes (if any)');

    // 2. Create named constraints so Strapi's "DROP CONSTRAINT" step succeeds.
    //    Uses DO $$ block to ignore "already exists" error.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE up_users
          ADD CONSTRAINT up_users_username_unique UNIQUE (username);
      EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE up_users
          ADD CONSTRAINT up_users_email_unique UNIQUE (email);
      EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL;
      END $$
    `);
    strapi.log.info('[register] ensured named unique constraints on up_users');
  } finally {
    await client.end();
  }
}

module.exports = {
  /**
   * register() runs before DB migrations.
   * Uses a direct pg connection (bypasses strapi.db timing) to prepare the DB
   * so Strapi's own migrations can run without conflicts.
   */
  async register({ strapi }) {
    try {
      await preMigrationCleanup(strapi);
    } catch (e) {
      strapi.log.warn('[register] pre-migration cleanup skipped:', e.message);
    }
  },

  async bootstrap({ strapi }) {
    // ── Schema repair (idempotent) ────────────────────────────────────────────
    try {
      await repairUpUserSchema(strapi);
    } catch (e) {
      strapi.log.error('[repair] up_users schema repair failed:', e.message);
    }
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' }, populate: ['permissions'] });

    if (!authenticatedRole) return;

    const existingActions = new Set(
      (authenticatedRole.permissions ?? []).map((p) => p.action)
    );

    const toCreate = AUTHENTICATED_PERMISSIONS.filter((action) => !existingActions.has(action));

    if (toCreate.length > 0) {
      strapi.log.info(`[bootstrap] Granting ${toCreate.length} new permission(s) to Authenticated role`);
      await Promise.all(
        toCreate.map((action) =>
          strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: authenticatedRole.id },
          })
        )
      );
    }

    // Revoke grants that earlier deploys created and that must no longer exist: the
    // loop above only ever adds, so removing a line from the list is not enough.
    const REVOKED = [
      'api::lead.lead.find', 'api::lead.lead.findOne', 'api::lead.lead.update',
      'api::reservation.reservation.find', 'api::reservation.reservation.findOne', 'api::reservation.reservation.update',
      'api::favorite.favorite.findOne', 'api::saved-search.saved-search.findOne',
      'api::lead.lead.create', 'api::reservation.reservation.create', 'plugin::users-permissions.user.updateMe',
      // Agent operations: server token only (TEC-1343 review).
      'api::source-connection.source-connection.find',
      'api::source-connection.source-connection.findOne',
      'api::source-connection.source-connection.create',
      'api::source-connection.source-connection.update',
      'api::source-connection.source-connection.delete',
      'api::source-connection.source-connection.verify',
      'api::source-connection.source-connection.triggerSync',
      'api::source-listing.source-listing.find',
      'api::source-listing.source-listing.findOne',
      'api::sync-run.sync-run.find',
      'api::sync-run.sync-run.findOne',
      'api::sync-run-item.sync-run-item.find',
      'api::sync-run-item.sync-run-item.findOne',
      'api::policy-block-event.policy-block-event.find',
      'api::policy-block-event.policy-block-event.findOne',
      'api::canonical-listing.canonical-listing.find',
      'api::canonical-listing.canonical-listing.findOne',
      'api::canonical-listing.canonical-listing.create',
      'api::canonical-listing.canonical-listing.update',
      'api::canonical-listing.canonical-listing.delete',
      'api::agency.agency.find',
      'api::agency.agency.findOne',
      'api::agency.agency.create',
      'api::agency.agency.update',
      'api::agency-membership.agency-membership.find',
      'api::agency-membership.agency-membership.findOne',
      'api::agency-membership.agency-membership.create',
      'api::agency-membership.agency-membership.update',
      'api::agency-membership.agency-membership.delete',
      'api::agency-membership.agency-membership.accept',
      'api::agency-membership.agency-membership.decline',
      'api::agent-invite.agent-invite.find',
      'api::agent-invite.agent-invite.findOne',
      'api::agent-invite.agent-invite.create',
      'api::agent-invite.agent-invite.delete',
      'api::listing-space.listing-space.find',
      'api::listing-space.listing-space.findOne',
      'api::listing-space.listing-space.create',
      'api::listing-space.listing-space.update',
      'api::listing-space.listing-space.delete',
      'api::listing-availability.listing-availability.find',
      'api::listing-availability.listing-availability.findOne',
      'api::listing-availability.listing-availability.create',
      'api::listing-availability.listing-availability.update',
      'api::listing-availability.listing-availability.delete',
    ];
    const toRevoke = (authenticatedRole.permissions ?? []).filter((p) => REVOKED.includes(p.action));
    if (toRevoke.length > 0) {
      strapi.log.info(`[bootstrap] Revoking ${toRevoke.length} permission(s) from Authenticated role`);
      await Promise.all(toRevoke.map((p) => strapi.query('plugin::users-permissions.permission').delete({ where: { id: p.id } })));
    }

    // ── Public role permissions (read-only editorial content) ─────────────────
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' }, populate: ['permissions'] });

    if (publicRole) {
      const existingPublicActions = new Set(
        (publicRole.permissions ?? []).map((p) => p.action)
      );
      const publicToCreate = PUBLIC_PERMISSIONS.filter((action) => !existingPublicActions.has(action));
      if (publicToCreate.length > 0) {
        strapi.log.info(`[bootstrap] Granting ${publicToCreate.length} new permission(s) to Public role`);
        await Promise.all(
          publicToCreate.map((action) =>
            strapi.query('plugin::users-permissions.permission').create({
              data: { action, role: publicRole.id },
            })
          )
        );
      }
    }

    // ── Custom roles (D1b) ────────────────────────────────────────────────────
    const CUSTOM_ROLES = [
      { name: 'Agent',       description: 'Individual real-estate agent' },
      { name: 'AgencyOwner', description: 'Agency owner — full agency management' },
      { name: 'AgencyStaff', description: 'Agency staff — listing management within agency scope' },
      { name: 'Host',        description: 'Short-stay host — short-stay listing management' },
      { name: 'Moderator',   description: 'Platform moderator — read-all + content review' },
    ];

    for (const roleSpec of CUSTOM_ROLES) {
      const existing = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { name: roleSpec.name } });
      if (!existing) {
        strapi.log.info(`[bootstrap] Creating custom role: ${roleSpec.name}`);
        await strapi.query('plugin::users-permissions.role').create({
          data: { name: roleSpec.name, description: roleSpec.description, type: roleSpec.name.toLowerCase() },
        });
      }
    }

    // ── Account emails (TEC-1344) ─────────────────────────────────────────────
    // Links in password-reset and confirmation emails go to the site, not to Strapi; the
    // wording is plain. SITE_URL changes at cutover. Email confirmation for new accounts is
    // switched by EMAIL_CONFIRMATION so the site can be ready before it is turned on.
    try {
      const site = (process.env.SITE_URL || 'https://alleyne-real-estate.vercel.app').replace(/\/$/, '');
      const from = process.env.EMAIL_FROM || '';
      const m = from.match(/^(.*)<(.+)>$/);
      const fromObj = { name: (m ? m[1] : 'Alleyne Real Estate').trim() || 'Alleyne Real Estate', email: (m ? m[2] : from).trim() };
      const upStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const advanced = (await upStore.get({ key: 'advanced' })) || {};
      await upStore.set({
        key: 'advanced',
        value: {
          ...advanced,
          unique_email: true,
          allow_register: true,
          email_reset_password: `${site}/reset-password`,
          email_confirmation: process.env.EMAIL_CONFIRMATION === 'true',
          email_confirmation_redirection: `${site}/signin?confirmed=1`,
        },
      });
      const templates = (await upStore.get({ key: 'email' })) || {};
      const tpl = (key, object, message) => ({
        ...(templates[key] || {}),
        options: { ...((templates[key] || {}).options || {}), from: fromObj, response_email: process.env.EMAIL_REPLY_TO || 'info@jalbarbados.com', object, message },
      });
      await upStore.set({
        key: 'email',
        value: {
          ...templates,
          reset_password: tpl(
            'reset_password',
            'Reset your Alleyne Real Estate password',
            '<p>Hello,</p><p>We received a request to reset the password for your Alleyne Real Estate account.</p>' +
              '<p><a href="<%= URL %>?code=<%= TOKEN %>">Choose a new password</a></p>' +
              '<p>If you did not ask for this, you can ignore this email; your password stays the same.</p><p>Alleyne Real Estate</p>'
          ),
          email_confirmation: tpl(
            'email_confirmation',
            'Confirm your email for Alleyne Real Estate',
            '<p>Hello,</p><p>Please confirm your email address to finish creating your Alleyne Real Estate account.</p>' +
              '<p><a href="<%= URL %>?confirmation=<%= CODE %>">Confirm my email</a></p>' +
              '<p>If you did not create an account, you can ignore this email.</p><p>Alleyne Real Estate</p>'
          ),
        },
      });
    } catch (err) {
      strapi.log.warn(`[bootstrap] account email settings skipped: ${err.message}`);
    }

    // ── firstPublicAt backfill (TEC-1343 second review) ───────────────────────
    // Listings that were already out (published, not a draft) before firstPublicAt existed
    // get their listing date (or creation) as their first-public moment. Without it, a
    // legacy listing that is paused and brought back, or sold and relisted, would be
    // stamped as brand new and sent to every matching alert. Idempotent: only fills blanks.
    try {
      const meta = strapi.db.metadata.get('api::canonical-listing.canonical-listing');
      const col = (a) => meta.attributes[a].columnName;
      const knex = strapi.db.connection;
      const filled = await knex(meta.tableName)
        .whereNull(col('firstPublicAt'))
        .whereNotNull(col('publishedAt'))
        .whereNot(col('status'), 'draft')
        .update({ [col('firstPublicAt')]: knex.raw(`COALESCE(CAST(?? AS timestamp), ??)`, [col('listedAt'), col('createdAt')]) });
      if (filled) strapi.log.info(`[bootstrap] firstPublicAt backfilled on ${filled} listing(s)`);
    } catch (err) {
      strapi.log.warn(`[bootstrap] firstPublicAt backfill skipped: ${err.message}`);
    }
  },
};
