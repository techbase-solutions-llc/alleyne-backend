// src/utils/account-emails.js
'use strict';

// The account emails the backend sends (email system of 12 Oct 2026, layout L6, TEC-1652), in
// the layout of the website's email blocks (alleyne-real-estate src/lib/email/blocks.ts):
// - confirm your email and reset your password, saved in Strapi's settings with Strapi's own
//   placeholders: the reset link is <%= URL %>?code=<%= TOKEN %>, the confirm link is the
//   site's /confirm-email?confirmation=<%= CODE %>;
// - the notices the backend sends itself (plan D4, 26 Oct 2026; TEC-1909): password changed,
//   welcome after confirming, and "you already have an account" for a sign-up with a known
//   address. These carry their own plain text.
// __SITE__ and __HOST__ are filled with the site address (SITE_URL).
//
// A reset link works once, within 60 minutes (plan A1, utils/account-security.js).

/** Bumped from v2 (links that never expired) so deployments that already wrote v2 take the
    60-minute wording once; later edits in the admin panel are kept after that. */
const TEMPLATE_VERSION = 'alleyne-email-templates-v3';

const { htmlToText } = require('./email-text');

const SERIF = "'Tenor Sans', Optima, Candara, Georgia, serif";
const SANS = 'Arial, Helvetica, sans-serif';
const WRAP = 'word-break:break-word;overflow-wrap:anywhere;';
const row = (pad, inner) => `<tr><td style="padding:${pad};${WRAP}">${inner}</td></tr>`;
const para = (size, colour, html) => `<p style="margin:0;font-family:${SANS};font-size:${size}px;line-height:1.6;color:${colour}">${html}</p>`;
const FOOT_TD = `font-family:${SANS};font-size:12px;line-height:1.6;color:#5B6182;${WRAP}`;

/** One block as a table row. The words are trusted markup: every wording here is fixed. */
function blockHtml(b) {
  switch (b.t) {
    case 'kicker': return row('0 0 6px', `<span style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5B6182">${b.v}</span>`);
    case 'title': return row('0 0 14px', `<h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:26px;line-height:1.25;color:#28335F">${b.v}</h1>`);
    case 'p': return row('0 0 16px', para(16, '#3A4061', b.v));
    case 'small': return row('0 0 16px', para(13, '#5B6182', b.v));
    case 'btn': return row('6px 0 20px', `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#28335F" style="border-radius:4px;background:#28335F;"><a href="${b.url}" style="display:inline-block;padding:14px 22px;font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;border-radius:4px;text-align:center">${b.label}</a></td></tr></table>`);
    case 'fallback': return row('0 0 20px', para(13, '#5B6182', `If the button does not work, copy this link into your browser:<br><a href="${b.url}" style="color:#28335F;word-break:break-all">${b.url}</a>`));
    default: throw new Error(`Unknown email block ${b.t}`);
  }
}

/** A whole account email as HTML, with __SITE__ and __HOST__ still to fill. */
function layout({ subject, pre, blocks, why }) {
  const foot = [
    'Alleyne Real Estate · Chattel Village, Holetown, St James, Barbados',
    '<a href="tel:+12464321159" style="color:#5B6182;white-space:nowrap">1 (246) 432-1159</a> · <a href="__SITE__" style="color:#5B6182">__HOST__</a>',
    why,
  ].map((x, i) => `<tr><td style="padding:${i ? '6px' : '0'} 0 0;${FOOT_TD}">${x}</td></tr>`).join('');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    `<title>${subject}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#F9F6F1;-webkit-text-size-adjust:100%">',
    `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F9F6F1;opacity:0">${pre}</div>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F9F6F1" style="background:#F9F6F1"><tr><td align="center" style="padding:28px 16px 36px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">',
    `<tr><td align="center" style="padding:0 0 26px"><a href="__SITE__"><img src="__SITE__/brand/alleyne-wordmark-email.png" width="200" height="40" alt="Alleyne Real Estate" style="display:block;width:200px;height:40px;border:0;font-family:${SERIF};font-size:20px;line-height:40px;color:#28335F;text-align:center"></a></td></tr>`,
    ...blocks.map(blockHtml),
    `<tr><td style="padding:22px 0 0;border-top:1px solid #DDD3C2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">${foot}</table></td></tr>`,
    '</table>',
    '</td></tr></table>',
    '</body>',
    '</html>',
  ].join('\n') + '\n';
}

const RESET_SUBJECT = 'Reset your Alleyne Real Estate password';
const RESET_HTML = layout({
  subject: RESET_SUBJECT,
  pre: 'Choose a new password for your Alleyne account.',
  blocks: [
    { t: 'kicker', v: 'Your account' },
    { t: 'title', v: 'Reset your password' },
    { t: 'p', v: 'We had a request to reset the password for your Alleyne account. Press the button to choose a new one.' },
    { t: 'btn', label: 'Choose a new password', url: '<%= URL %>?code=<%= TOKEN %>' },
    { t: 'fallback', url: '<%= URL %>?code=<%= TOKEN %>' },
    { t: 'small', v: 'Did not ask for this? Ignore this email and your password stays the same. If it keeps happening, write to info@jalbarbados.com.' },
    { t: 'small', v: 'The link works once, within 60 minutes.' },
  ],
  why: 'You got this because someone asked to reset the password for this address on __HOST__.',
});

const CONFIRM_SUBJECT = 'Confirm your email for Alleyne Real Estate';
const CONFIRM_HTML = layout({
  subject: CONFIRM_SUBJECT,
  pre: 'Confirm your email to finish opening your account.',
  blocks: [
    { t: 'kicker', v: 'Your account' },
    { t: 'title', v: 'Confirm your email' },
    { t: 'p', v: 'Welcome to Alleyne Real Estate. Confirm your email to save properties and searches, and to get alerts when something new matches.' },
    { t: 'btn', label: 'Confirm my email', url: '__SITE__/confirm-email?confirmation=<%= CODE %>' },
    { t: 'fallback', url: '__SITE__/confirm-email?confirmation=<%= CODE %>' },
    { t: 'small', v: 'Did not open an account? You can ignore this email. Nobody can use the account until the email is confirmed.' },
  ],
  why: 'You got this because an account was opened on __HOST__ with this address. If it was not you, ignore this email: the account will not be activated.',
});

/** "26 October 2026 at 2:15 pm" in Barbados time. */
const barbadosTime = (when) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Barbados', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(when)
    .replace(',', ' at');

const NOTICES = {
  password_changed: ({ when }) => ({
    subject: 'Your Alleyne Real Estate password was changed',
    pre: 'If you changed it, there is nothing more to do.',
    blocks: [
      { t: 'kicker', v: 'Your account' },
      { t: 'title', v: 'Your password was changed' },
      { t: 'p', v: `The password for your Alleyne account was changed on ${barbadosTime(when)} (Barbados time). If you were signed in anywhere else, you will need to sign in again there.` },
      { t: 'btn', label: 'Sign in', url: '__SITE__/signin' },
      { t: 'small', v: 'Did not change it? Choose a new password straight away at <a href="__SITE__/forgot-password" style="color:#28335F">__SITE__/forgot-password</a> and write to info@jalbarbados.com so we can help.' },
    ],
    why: 'You got this because the password for this address was changed on __HOST__.',
  }),
  welcome: () => ({
    subject: 'Welcome to Alleyne Real Estate',
    pre: 'Your email is confirmed and your account is ready.',
    blocks: [
      { t: 'kicker', v: 'Your account' },
      { t: 'title', v: 'Your account is ready' },
      { t: 'p', v: 'Thank you for confirming your email. Sign in to save the properties you like and the searches you run often. A saved search can email you when a new property matches it.' },
      { t: 'btn', label: 'Sign in', url: '__SITE__/signin' },
      { t: 'small', v: 'Questions about buying, renting or a holiday stay? Write to info@jalbarbados.com or call 1 (246) 432-1159.' },
    ],
    why: 'You got this because you confirmed an account on __HOST__ with this address.',
  }),
  account_exists: () => ({
    subject: 'You already have an Alleyne Real Estate account',
    pre: 'Sign in, or choose a new password if you have forgotten it.',
    blocks: [
      { t: 'kicker', v: 'Your account' },
      { t: 'title', v: 'You already have an account' },
      { t: 'p', v: 'Someone, probably you, tried to open an Alleyne account with this email address. There is already an account for it, so no new one was made.' },
      { t: 'btn', label: 'Sign in', url: '__SITE__/signin' },
      { t: 'small', v: 'Forgotten your password? Choose a new one at <a href="__SITE__/forgot-password" style="color:#28335F">__SITE__/forgot-password</a>.' },
      { t: 'small', v: 'Did not try to sign up? You can ignore this email. Nothing has changed on your account.' },
    ],
    why: 'You got this because someone tried to open an account on __HOST__ with this address.',
  }),
};

/** A notice the backend sends itself: subject, HTML and plain text for a site. */
function noticeEmail(kind, { site, when = new Date() } = {}) {
  const make = NOTICES[kind];
  if (!make) throw new Error(`Unknown account notice ${kind}`);
  const spec = make({ when });
  const html = fill(layout(spec), site);
  return { subject: spec.subject, html, text: htmlToText(html) };
}

/** The website's address, from SITE_URL; the preview address until the cutover. */
const siteUrl = (env = process.env) => (env.SITE_URL || 'https://alleyne-real-estate.vercel.app').replace(/\/+$/, '');

const trimSite = (site) => String(site || '').replace(/\/+$/, '');
/** "www.example.com" from "https://www.example.com/". */
function hostOf(site) {
  try { return new URL(site).host; } catch { return trimSite(site).replace(/^https?:\/\//, ''); }
}
const fill = (html, site) => html.split('__SITE__').join(trimSite(site)).split('__HOST__').join(hostOf(site));

/** Subject and HTML of each account email for a site. */
function accountTemplates(site) {
  return {
    reset_password: { object: RESET_SUBJECT, message: fill(RESET_HTML, site) },
    email_confirmation: { object: CONFIRM_SUBJECT, message: fill(CONFIRM_HTML, site) },
  };
}

/** The confirm link goes to the website, which passes the code on (5 Oct 2026: the old link
    showed the backend's own address). Applied on every boot to whatever wording is saved, so
    admin-panel edits survive. Either quote style, with or without spaces inside <%= %>. */
function siteConfirmLink(t, site) {
  const msg = t && t.options && t.options.message;
  if (typeof msg !== 'string') return t;
  const next = msg.replace(/href=(["'])[^"']*\?confirmation=<%=\s*CODE\s*%>\1/g, `href="${trimSite(site)}/confirm-email?confirmation=<%= CODE %>"`);
  return { ...t, options: { ...t.options, message: next } };
}

/** The saved wording with an earlier site address (and its host name) changed to the new
    one, for the cutover: the wordmark, the links and the footer follow SITE_URL, and any
    admin-panel edit is kept. */
function moveSite(message, from, to) {
  if (typeof message !== 'string' || !from || trimSite(from) === trimSite(to)) return message;
  const moved = message.split(trimSite(from)).join(trimSite(to));
  // The bare host only where it stands alone: not inside an email address, a longer host
  // (www.<host>, already moved above) or a longer name (review, 13 Oct: a plain swap gave
  // www.www.<host> and info@www.<host> when the new site only added www).
  const host = hostOf(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return moved.replace(new RegExp(`(?<![\\w.@-])${host}(?![\\w-])`, 'g'), hostOf(to));
}

/** The users-permissions "email" settings to save on boot, and the version record to save
    (null: leave it). `written`: the version record saved before ({ at, site }), or null.
    The wording is written when this version has never been written; after that it is kept,
    only moved to a new site address. Sender and reply-to follow the environment every boot
    (an unset sender leaves it as it is). */
function nextEmailSettings({ templates, written, site, from, replyTo, now = new Date() }) {
  const saved = templates || {};
  const firstTime = !written;
  const movedFrom = !firstTime && written.site && trimSite(written.site) !== trimSite(site) ? written.site : null;
  const fresh = accountTemplates(site);
  const tpl = (key) => {
    const current = (saved[key] || {}).options || {};
    const moved = movedFrom && typeof current.message === 'string' ? { message: moveSite(current.message, movedFrom, site) } : {};
    return {
      ...(saved[key] || {}),
      options: {
        ...current,
        ...(from && from.email ? { from } : {}),
        response_email: replyTo || current.response_email || 'info@jalbarbados.com',
        ...moved,
        ...(firstTime ? { object: fresh[key].object, message: fresh[key].message } : {}),
      },
    };
  };
  return {
    email: { ...saved, reset_password: tpl('reset_password'), email_confirmation: siteConfirmLink(tpl('email_confirmation'), site) },
    version: firstTime || movedFrom ? { at: now.toISOString(), site: trimSite(site) } : null,
  };
}

module.exports = { TEMPLATE_VERSION, accountTemplates, siteConfirmLink, moveSite, nextEmailSettings, hostOf, noticeEmail, siteUrl };
