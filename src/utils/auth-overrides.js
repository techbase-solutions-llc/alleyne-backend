'use strict';
// The users-permissions changes of the public user area plan, section A (26 Oct 2026;
// TEC-1909). Each is a wrapper round Strapi's own code, so Strapi still does the work and this
// adds the rule. Wired in src/extensions/users-permissions/strapi-server.js. `deps.strapi` is for
// tests; the running backend uses the global strapi.
//
// - Sessions end when the password changes (A2): a sign-in token issued before the account's
//   passwordChangedAt is refused, so every request with it gets 401.
// - Reset links work for 60 minutes (A1).
// - Sign-up checks the name and an 8-character password itself (A3), and an address that already
//   has an account gets the same answer as a new one, with an email to that address instead.
// - The account owner is told by email when their password changes, and welcomed when their
//   email is confirmed (D4, backend side).
// - A deleted account takes its saved properties and searches with it (A5).

const { errors, yup } = require('@strapi/utils');
const bcrypt = require('bcryptjs');
const sec = require('./account-security');
const { noticeEmail, siteUrl } = require('./account-emails');
const { INVITE_PREFIX, tokenOnly } = require('./invite-code');
const { savedItemsToRemove, removeSavedItems } = require('./user-cleanup');

const { ValidationError, ApplicationError } = errors;
const USER = 'plugin::users-permissions.user';

/** Strapi's message when the name (username) or email clashes. With known emails answered
    before Strapi is asked, it can only be the name. */
const NAME_TAKEN = 'That name is already used by another account. Add a middle initial or a surname.';

const strapiOf = (deps) => (deps && deps.strapi) || global.strapi;
/** Sends that need not hold up the answer. Never rejects: sendAccountNotice catches. */
const inBackground = (p) => { Promise.resolve(p).catch(() => {}); };

/** Sends one account notice from the account email sender (the reset email's From and
    Reply-To, which follow EMAIL_FROM and EMAIL_REPLY_TO on every boot). Never throws; a failure
    is logged without the address. */
async function sendAccountNotice(strapi, kind, to, { when, env } = {}) {
  try {
    if (!to) return false;
    const settings = (await strapi.store({ type: 'plugin', name: 'users-permissions' }).get({ key: 'email' })) || {};
    const o = (settings.reset_password && settings.reset_password.options) || {};
    const from = o.from && o.from.email ? `${o.from.name || 'Alleyne Real Estate'} <${o.from.email}>` : undefined;
    const e = noticeEmail(kind, { site: siteUrl(env), when });
    await strapi.plugin('email').service('email').send({ to, from, replyTo: o.response_email || undefined, subject: e.subject, html: e.html, text: e.text });
    return true;
  } catch (err) {
    strapi.log?.error?.(`[account-notice] ${kind} not sent: ${err.message}`);
    return false;
  }
}

/** Strapi's jwt service with one more check in verify (A2). getToken, which the sign-in
    strategy uses, calls this.verify, so every authenticated request is checked. A failed
    lookup refuses the token. */
function withTokenRevocation(makeJwt) {
  return (deps) => {
    const svc = makeJwt(deps);
    const verify = svc.verify;
    svc.verify = async function verifyNotRevoked(token) {
      const payload = await verify.call(this, token);
      if (payload && payload.id !== undefined) {
        const user = await strapiOf(deps).db.query(USER).findOne({ where: { id: payload.id }, select: ['id', 'passwordChangedAt'] });
        if (user && sec.tokenRevoked({ iat: payload.iat, passwordChangedAt: user.passwordChangedAt })) throw new Error('Invalid token.');
      }
      return payload;
    };
    return svc;
  };
}

/** Strapi's register with the website's rules and no account enumeration (A3). */
function wrapRegister(original, deps = {}) {
  const limiter = deps.limiter || sec.noticeLimiter();
  const now = deps.now || Date.now;
  // Strapi hashes a new account's password (10 rounds); a known address does the same work,
  // so the two take about as long (adversarial review, 26 Oct 2026).
  const hash = deps.hash || ((password) => bcrypt.hash(password, 10));
  return async function register(ctx, ...rest) {
    const strapi = strapiOf(deps);
    const body = (ctx.request && ctx.request.body) || {};
    const problem = sec.registerProblem(body);
    if (problem) throw new ValidationError(problem);
    // Both paths use the same address, and Strapi's own email check runs first: otherwise an
    // address with spaces round it, or one only the simple pattern allows, succeeded when
    // known and failed when new (adversarial review, 26 Oct 2026).
    const email = body.email.trim().toLowerCase();
    if (!yup.string().email().isValidSync(email)) throw new ValidationError('Enter your email address.');
    body.email = email;
    body.username = sec.tidyName(body.username);
    // What a new sign-up waiting for its confirmation email looks like to anyone but the site.
    const reply = { user: { username: body.username, email, confirmed: false } };

    // Registration switched off in the admin panel: Strapi refuses every address alike.
    const advanced = (await strapi.store({ type: 'plugin', name: 'users-permissions' }).get({ key: 'advanced' })) || {};
    if (!advanced.allow_register) return original.call(this, ctx, ...rest);

    // A taken name first, whatever the email: checked after the email, "name taken" for a new
    // address and "check your email" for a known one told a stranger which addresses had an
    // account (review, 26 Oct). Exact, as Strapi's own uniqueness check is; hashed as a new
    // account would be, so it takes as long.
    const nameOwner = await strapi.db.query(USER).findOne({ where: { username: body.username }, select: ['id'] });
    if (nameOwner) {
      await hash(body.password);
      throw new ApplicationError(NAME_TAKEN);
    }

    // Exact, as Strapi's own lookups are (emails are stored in lower case). $eqi is SQL LIKE:
    // % and _ in the address would match other accounts and email them.
    const known = await strapi.db.query(USER).findOne({ where: { email }, select: ['id', 'email', 'username', 'confirmed', 'blocked'] });
    if (known) {
      await hash(body.password);
      // Awaited, as Strapi awaits a new account's confirmation email, so both take as long.
      if (!known.blocked && limiter.allow(email, now())) {
        if (known.confirmed) await sendAccountNotice(strapi, 'account_exists', known.email, { env: deps.env });
        else {
          try {
            await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(known);
          } catch (err) {
            strapi.log?.error?.(`[register] confirmation email not sent again: ${err.message}`);
          }
        }
      }
      ctx.send(reply);
      return;
    }

    try {
      await original.call(this, ctx, ...rest);
    } catch (err) {
      if (/already taken/i.test(err && err.message)) throw new ApplicationError(NAME_TAKEN);
      throw err;
    }
    // The address now has an account: a second try within the hour sends nothing, as for an
    // address that had one already (adversarial review, 26 Oct 2026).
    limiter.allow(email, now());
    // Only the website's server token learns the new account's id (it records marketing
    // consent with it). Anyone else sees the same answer as for a known address.
    if (!tokenOnly(ctx) && ctx.body && ctx.body.user && !ctx.body.jwt) ctx.body = reply;
  };
}

/** Strapi's reset-password, refusing a forgotten-password code older than 60 minutes (A1) and a
    password under 8 characters, then telling the owner (D4). */
function wrapResetPassword(original, deps = {}) {
  const now = deps.now || Date.now;
  const later = deps.later || inBackground;
  return async function resetPassword(ctx, ...rest) {
    const strapi = strapiOf(deps);
    const body = (ctx.request && ctx.request.body) || {};
    const code = typeof body.code === 'string' ? body.code : '';
    const user = code
      ? await strapi.db.query(USER).findOne({ where: { resetPasswordToken: code }, select: ['id', 'email', 'resetPasswordRequestedAt'] })
      : null;
    if (user && sec.resetCodeExpired({ code, requestedAt: user.resetPasswordRequestedAt, now: now() })) throw new ValidationError(sec.RESET_EXPIRED_MESSAGE);
    if (typeof body.password === 'string' && sec.passwordProblem(body.password)) throw new ValidationError(sec.passwordProblem(body.password));
    await original.call(this, ctx, ...rest);
    // A first password set through an invitation is not a change to warn about.
    if (user && !code.startsWith(INVITE_PREFIX)) later(sendAccountNotice(strapi, 'password_changed', user.email, { env: deps.env }));
  };
}

/** Strapi's change-password with the 8-character rule, then the email to the owner (D4). */
function wrapChangePassword(original, deps = {}) {
  const later = deps.later || inBackground;
  return async function changePassword(ctx, ...rest) {
    const body = (ctx.request && ctx.request.body) || {};
    if (typeof body.password === 'string' && sec.passwordProblem(body.password)) throw new ValidationError(sec.passwordProblem(body.password));
    await original.call(this, ctx, ...rest);
    const user = ctx.state && ctx.state.user;
    if (user && user.email) later(sendAccountNotice(strapiOf(deps), 'password_changed', user.email, { env: deps.env }));
  };
}

/** Forgot password and resend confirmation answer this long after the request, whatever the
    address: known (code written, email sent), unknown (nothing to do) or with a slow mail server. */
const LOOKUP_MIN_MS = 1500;
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs Strapi's handler against a stand-in for the request, so its own answer is never sent,
    and answers `answer` at the floor (review, 27 Oct). A badly formed request is refused as
    Strapi refuses it. Anything still running at the floor (the email) finishes in the
    background, and a failure is logged unless `quiet(err)` says it is expected. */
function answerAtFloor(label, original, deps, answer, quiet = () => false) {
  const min = deps.minMs ?? LOOKUP_MIN_MS;
  const sleep = deps.sleep || realSleep;
  const log = (err) => { if (!quiet(err)) strapiOf(deps).log?.error?.(`[${label}] not sent: ${err && err.message}`); };
  return async function atFloor(ctx, ...rest) {
    const shadow = Object.create(ctx);
    shadow.send = () => {};
    const work = Promise.resolve().then(() => original.call(this, shadow, ...rest)).then(() => null, (err) => err);
    const floor = sleep(min);
    const first = await Promise.race([work.then((err) => ({ err })), floor.then(() => null)]);
    if (first && first.err instanceof ValidationError) throw first.err;
    if (first) {
      if (first.err) log(first.err);
      await floor;
    } else {
      work.then((err) => { if (err) log(err); });
    }
    ctx.send(answer(ctx));
  };
}

/** Strapi's forgot-password with one answer, at one time, for every address (review, 27 Oct). */
function wrapForgotPassword(original, deps = {}) {
  return answerAtFloor('forgot-password', original, deps, () => ({ ok: true }));
}

/** Strapi's resend-confirmation with one answer, at one time, for every address (review, 27
    Oct): it said "Already confirmed" or "User blocked" for an account, which told a stranger it
    existed. An unconfirmed account is sent its email as before. */
function wrapSendEmailConfirmation(original, deps = {}) {
  return answerAtFloor('send-email-confirmation', original, deps, (ctx) => {
    const body = (ctx.request && ctx.request.body) || {};
    return { email: String(body.email || '').trim().toLowerCase(), sent: true };
  }, (err) => err instanceof ApplicationError);
}

/** The user content type's lifecycle: the stamps (A1, A2), the welcome email when an account is
    first confirmed, however that happens (D4), and the delete clean-up (A5). Strapi passes the
    same event.state to the before and after halves. */
function userLifecycles(deps = {}) {
  const now = deps.now || Date.now;
  const later = deps.later || inBackground;
  return {
    async beforeUpdate(event) {
      event.params.data = sec.userUpdateStamps({ data: event.params.data, now: new Date(now()) });
      if (event.params.data.confirmed === true) {
        const prev = await strapiOf(deps).db.query(USER).findOne({ where: event.params.where, select: ['id', 'email', 'confirmed'] });
        if (prev && prev.confirmed !== true) event.state.welcome = prev.email;
      }
    },
    async afterUpdate(event) {
      const to = event.state && event.state.welcome;
      if (to) later(sendAccountNotice(strapiOf(deps), 'welcome', (event.result && event.result.email) || to, { env: deps.env }));
    },
    async beforeDelete(event) {
      event.state.saved = await savedItemsToRemove(strapiOf(deps).db, event.params.where);
    },
    async afterDelete(event) {
      await removeSavedItems(strapiOf(deps).db, event.state.saved);
    },
    async beforeDeleteMany(event) {
      event.state.saved = await savedItemsToRemove(strapiOf(deps).db, event.params.where);
    },
    async afterDeleteMany(event) {
      await removeSavedItems(strapiOf(deps).db, event.state.saved);
    },
  };
}

module.exports = {
  NAME_TAKEN, LOOKUP_MIN_MS, sendAccountNotice, withTokenRevocation, wrapRegister, wrapResetPassword, wrapChangePassword,
  wrapForgotPassword, wrapSendEmailConfirmation, userLifecycles,
};
