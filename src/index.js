'use strict';

// Public role grants and the grants every boot removes (review, 8 Oct 2026).
const { PUBLIC_PERMISSIONS, PUBLIC_REVOKED, LISTING_NOTE_ACTIONS, LISTING_TRANSACTION_ACTIONS, toRevoke, officeOnlyGrants } = require('./utils/role-permissions');
const { trustLastProxyHop } = require('./utils/client-ip');
const { TEMPLATE_VERSION, nextEmailSettings, siteUrl } = require('./utils/account-emails');

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
    // The caller's address for rate limits is the hop Render's proxy added, never one the
    // caller wrote into X-Forwarded-For (review, 8 Oct 2026; utils/client-ip.js).
    trustLastProxyHop(strapi.server.app);
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
      // The office's listing notes: server token only (session 4, TEC-1909).
      ...LISTING_NOTE_ACTIONS,
      // The office's listing transactions likewise (Orna, 23 Oct 2026; TEC-1909).
      ...LISTING_TRANSACTION_ACTIONS,
    ];
    // Named authToRevoke: `toRevoke` is the helper from role-permissions, used for the
    // Public role below (a local of the same name stopped the backend starting; review).
    const authToRevoke = toRevoke(authenticatedRole.permissions, REVOKED);
    if (authToRevoke.length > 0) {
      strapi.log.info(`[bootstrap] Revoking ${authToRevoke.length} permission(s) from Authenticated role`);
      await Promise.all(authToRevoke.map((p) => strapi.query('plugin::users-permissions.permission').delete({ where: { id: p.id } })));
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
      const publicToRevoke = toRevoke(publicRole.permissions, PUBLIC_REVOKED);
      if (publicToRevoke.length > 0) {
        strapi.log.info(`[bootstrap] Revoking ${publicToRevoke.length} permission(s) from Public role`);
        await Promise.all(publicToRevoke.map((p) => strapi.query('plugin::users-permissions.permission').delete({ where: { id: p.id } })));
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

    // ── Listing notes and transactions: no role at all (TEC-1909) ─────────────
    // The Public and Authenticated lists above only cover those two roles. A notes or
    // transactions box ticked for Agent, AgencyOwner, AgencyStaff, Host, Moderator or any
    // later role would let that role read every office record with its own JWT, so every
    // role is checked on every boot. The website reaches them with its server token, which
    // is not a role. Rows are re-read here, so a grant already removed above is not deleted
    // twice.
    const allRoles = await strapi
      .query('plugin::users-permissions.role')
      .findMany({ populate: ['permissions'] });
    const noteGrants = officeOnlyGrants(allRoles);
    if (noteGrants.length > 0) {
      strapi.log.warn(
        `[bootstrap] Revoking ${noteGrants.length} office-only permission(s): ` +
          noteGrants.map((p) => `${p.role} ${p.action}`).join(', ')
      );
      await Promise.all(noteGrants.map((p) => strapi.query('plugin::users-permissions.permission').delete({ where: { id: p.id } })));
    }

    // ── Admin-panel account from settings (TEC-1344) ──────────────────────────
    // Strapi has no API for admin-panel users. When ADMIN_BOOTSTRAP_EMAIL and
    // ADMIN_BOOTSTRAP_PASSWORD are set, a super admin with that email is created (or, with
    // ADMIN_BOOTSTRAP_RESET=true, its password reset). Remove the settings after one deploy;
    // the account stays. Nothing happens without them.
    try {
      const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
      const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
      if (email && password) {
        const existing = await strapi.query('admin::user').findOne({ where: { email } });
        if (!existing) {
          const superAdmin = await strapi.service('admin::role').getSuperAdmin();
          await strapi.service('admin::user').create({ email, firstname: 'Techbase', lastname: 'Admin', password, isActive: true, registrationToken: null, roles: superAdmin ? [superAdmin.id] : [] });
          strapi.log.info(`[bootstrap] admin-panel account created for ${email}`);
        } else if (process.env.ADMIN_BOOTSTRAP_RESET === 'true') {
          await strapi.service('admin::user').updateById(existing.id, { password, isActive: true });
          strapi.log.info(`[bootstrap] admin-panel password reset for ${email}`);
        }
      }
    } catch (err) {
      strapi.log.warn(`[bootstrap] admin-panel account step skipped: ${err.message}`);
    }

    // ── Account emails (TEC-1344) ─────────────────────────────────────────────
    // Links in password-reset and confirmation emails go to the site, not to Strapi; the
    // wording is plain. SITE_URL changes at cutover. Email confirmation for new accounts is
    // switched by EMAIL_CONFIRMATION so the site can be ready before it is turned on.
    try {
      const site = siteUrl();
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
          // allow_register is left as set in the admin panel (review: forcing it on every boot
          // meant registration could not be switched off in an emergency).
          email_reset_password: `${site}/reset-password`,
          email_confirmation: process.env.EMAIL_CONFIRMATION === 'true',
          email_confirmation_redirection: `${site}/signin?confirmed=1`,
        },
      });
      // The wording (email system of 12 Oct, utils/account-emails.js) is written once per
      // template version, so later edits in the admin panel survive restarts (review); the
      // version moved to v2 so deployments with the v1 wording take the new emails once.
      // Sender and reply-to follow the environment on every boot (they change at cutover);
      // an unset EMAIL_FROM leaves the sender as it is. A new SITE_URL moves the saved wording
      // to the new address, and the confirm link always goes to the website.
      const next = nextEmailSettings({
        templates: (await upStore.get({ key: 'email' })) || {},
        written: (await upStore.get({ key: TEMPLATE_VERSION })) || null,
        site,
        from: fromObj,
        replyTo: process.env.EMAIL_REPLY_TO,
      });
      await upStore.set({ key: 'email', value: next.email });
      if (next.version) await upStore.set({ key: TEMPLATE_VERSION, value: next.version });
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
        // Quiet listings are not public: they get their stamp when they go live (review).
        .whereNot(col('status'), 'quiet')
        .update({ [col('firstPublicAt')]: knex.raw(`COALESCE(CAST(?? AS timestamp), ??)`, [col('listedAt'), col('createdAt')]) });
      if (filled) strapi.log.info(`[bootstrap] firstPublicAt backfilled on ${filled} listing(s)`);
    } catch (err) {
      strapi.log.warn(`[bootstrap] firstPublicAt backfill skipped: ${err.message}`);
    }

    // ── soldAt backfill (TEC-1412) ─────────────────────────────────────────────
    // Sold listings from before soldAt existed start their Sold banner period now, so
    // the site's daily archive does not take them all down at once. Idempotent.
    try {
      const meta = strapi.db.metadata.get('api::canonical-listing.canonical-listing');
      const col = (a) => meta.attributes[a].columnName;
      const knex = strapi.db.connection;
      const stamped = await knex(meta.tableName)
        .where(col('status'), 'sold')
        .whereNull(col('soldAt'))
        .update({ [col('soldAt')]: knex.fn.now() });
      if (stamped) strapi.log.info(`[bootstrap] soldAt started on ${stamped} sold listing(s)`);
      // New fields default in Strapi, not in the database: fill older rows once so queries
      // (e.g. a future portal feed) can rely on them. Idempotent.
      const src = await knex(meta.tableName).whereNull(col('listingSource')).update({ [col('listingSource')]: 'direct' });
      const bps = await knex(meta.tableName).whereNull(col('syndicateBps')).update({ [col('syndicateBps')]: false });
      const rm = await knex(meta.tableName).whereNull(col('syndicateRightmove')).update({ [col('syndicateRightmove')]: false });
      if (src || bps || rm) strapi.log.info(`[bootstrap] defaults filled: listingSource ${src}, syndicateBps ${bps}, syndicateRightmove ${rm}`);
      // Barbados Property Search takes every direct sale listing unless told no (Eddie,
      // 28 Sep walkthrough), so existing direct sale listings start with the switch on.
      // Once only, so a switch turned off later stays off.
      const store = strapi.store({ type: 'core', name: 'alleyne-migrations' });
      if (!(await store.get({ key: 'bps-default-v1' }))) {
        const on = await knex(meta.tableName)
          .where(col('transactionType'), 'for_sale')
          .where(col('listingSource'), 'direct')
          .update({ [col('syndicateBps')]: true });
        await store.set({ key: 'bps-default-v1', value: { at: new Date().toISOString(), rows: on } });
        strapi.log.info(`[bootstrap] Barbados Property Search on for ${on} direct sale listing(s)`);
      }
    } catch (err) {
      strapi.log.warn(`[bootstrap] soldAt backfill skipped: ${err.message}`);
    }
  },
};
