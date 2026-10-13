// src/utils/account-emails.js
'use strict';

// The 2 account emails the backend sends (email system of 12 Oct 2026, layout L6, TEC-1652):
// confirm your email and reset your password. Rendered once from the website's email blocks
// (alleyne-real-estate src/lib/email/blocks.ts) and kept here as static HTML with Strapi's
// own placeholders: the reset link is <%= URL %>?code=<%= TOKEN %>, the confirm link is the
// site's /confirm-email?confirmation=<%= CODE %>. __SITE__ and __HOST__ are filled with the
// site address (SITE_URL) when the templates are written.
//
// Nothing here says how long a link works: Strapi's reset code has no expiry, it only stops
// working once used (its reset-password clears it), so the reset email says "only once".

/** Bumped from v1 (the plain wording) so deployments that already wrote v1 take this wording
    once; later edits in the admin panel are kept after that. */
const TEMPLATE_VERSION = 'alleyne-email-templates-v2';

const RESET_HTML = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<head>",
  "<meta charset=\"utf-8\">",
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
  "<meta name=\"x-apple-disable-message-reformatting\">",
  "<title>Reset your Alleyne Real Estate password</title>",
  "</head>",
  "<body style=\"margin:0;padding:0;background:#F9F6F1;-webkit-text-size-adjust:100%\">",
  "<div style=\"display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F9F6F1;opacity:0\">Choose a new password for your Alleyne account.</div>",
  "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#F9F6F1\" style=\"background:#F9F6F1\"><tr><td align=\"center\" style=\"padding:28px 16px 36px\">",
  "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px\">",
  "<tr><td align=\"center\" style=\"padding:0 0 26px\"><a href=\"__SITE__\"><img src=\"__SITE__/brand/alleyne-wordmark-email.png\" width=\"200\" height=\"40\" alt=\"Alleyne Real Estate\" style=\"display:block;width:200px;height:40px;border:0;font-family:'Tenor Sans', Optima, Candara, Georgia, serif;font-size:20px;line-height:40px;color:#28335F;text-align:center\"></a></td></tr>",
  "<tr><td style=\"padding:0 0 6px;word-break:break-word;overflow-wrap:anywhere;\"><span style=\"font-family:Arial, Helvetica, sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5B6182\">Your account</span></td></tr>",
  "<tr><td style=\"padding:0 0 14px;word-break:break-word;overflow-wrap:anywhere;\"><h1 style=\"margin:0;font-family:'Tenor Sans', Optima, Candara, Georgia, serif;font-weight:normal;font-size:26px;line-height:1.25;color:#28335F\">Reset your password</h1></td></tr>",
  "<tr><td style=\"padding:0 0 16px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:1.6;color:#3A4061\">We had a request to reset the password for your Alleyne account. Press the button to choose a new one.</p></td></tr>",
  "<tr><td style=\"padding:6px 0 20px;word-break:break-word;overflow-wrap:anywhere;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" bgcolor=\"#28335F\" style=\"border-radius:4px;background:#28335F;\"><a href=\"<%= URL %>?code=<%= TOKEN %>\" style=\"display:inline-block;padding:14px 22px;font-family:Arial, Helvetica, sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;border-radius:4px;text-align:center\">Choose a new password</a></td></tr></table></td></tr>",
  "<tr><td style=\"padding:0 0 20px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#5B6182\">If the button does not work, copy this link into your browser:<br><a href=\"<%= URL %>?code=<%= TOKEN %>\" style=\"color:#28335F;word-break:break-all\"><%= URL %>?code=<%= TOKEN %></a></p></td></tr>",
  "<tr><td style=\"padding:0 0 16px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#5B6182\">Did not ask for this? Ignore this email and your password stays the same. If it keeps happening, write to info@jalbarbados.com.</p></td></tr>",
  "<tr><td style=\"padding:0 0 16px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#5B6182\">The link works only once.</p></td></tr>",
  "<tr><td style=\"padding:22px 0 0;border-top:1px solid #DDD3C2\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:separate;\"><tr><td style=\"padding:0 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\">Alleyne Real Estate · Chattel Village, Holetown, St James, Barbados</td></tr><tr><td style=\"padding:6px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\"><a href=\"tel:+12464321159\" style=\"color:#5B6182;white-space:nowrap\">1 (246) 432-1159</a> · <a href=\"__SITE__\" style=\"color:#5B6182\">__HOST__</a></td></tr><tr><td style=\"padding:6px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\">You got this because someone asked to reset the password for this address on __HOST__.</td></tr></table></td></tr>",
  "</table>",
  "</td></tr></table>",
  "</body>",
  "</html>",
].join('\n') + '\n';

const CONFIRM_HTML = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<head>",
  "<meta charset=\"utf-8\">",
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
  "<meta name=\"x-apple-disable-message-reformatting\">",
  "<title>Confirm your email for Alleyne Real Estate</title>",
  "</head>",
  "<body style=\"margin:0;padding:0;background:#F9F6F1;-webkit-text-size-adjust:100%\">",
  "<div style=\"display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F9F6F1;opacity:0\">Confirm your email to finish opening your account.</div>",
  "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#F9F6F1\" style=\"background:#F9F6F1\"><tr><td align=\"center\" style=\"padding:28px 16px 36px\">",
  "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px\">",
  "<tr><td align=\"center\" style=\"padding:0 0 26px\"><a href=\"__SITE__\"><img src=\"__SITE__/brand/alleyne-wordmark-email.png\" width=\"200\" height=\"40\" alt=\"Alleyne Real Estate\" style=\"display:block;width:200px;height:40px;border:0;font-family:'Tenor Sans', Optima, Candara, Georgia, serif;font-size:20px;line-height:40px;color:#28335F;text-align:center\"></a></td></tr>",
  "<tr><td style=\"padding:0 0 6px;word-break:break-word;overflow-wrap:anywhere;\"><span style=\"font-family:Arial, Helvetica, sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#5B6182\">Your account</span></td></tr>",
  "<tr><td style=\"padding:0 0 14px;word-break:break-word;overflow-wrap:anywhere;\"><h1 style=\"margin:0;font-family:'Tenor Sans', Optima, Candara, Georgia, serif;font-weight:normal;font-size:26px;line-height:1.25;color:#28335F\">Confirm your email</h1></td></tr>",
  "<tr><td style=\"padding:0 0 16px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:1.6;color:#3A4061\">Welcome to Alleyne Real Estate. Confirm your email to save properties and searches, and to get alerts when something new matches.</p></td></tr>",
  "<tr><td style=\"padding:6px 0 20px;word-break:break-word;overflow-wrap:anywhere;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" bgcolor=\"#28335F\" style=\"border-radius:4px;background:#28335F;\"><a href=\"__SITE__/confirm-email?confirmation=<%= CODE %>\" style=\"display:inline-block;padding:14px 22px;font-family:Arial, Helvetica, sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;border-radius:4px;text-align:center\">Confirm my email</a></td></tr></table></td></tr>",
  "<tr><td style=\"padding:0 0 20px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#5B6182\">If the button does not work, copy this link into your browser:<br><a href=\"__SITE__/confirm-email?confirmation=<%= CODE %>\" style=\"color:#28335F;word-break:break-all\">__SITE__/confirm-email?confirmation=<%= CODE %></a></p></td></tr>",
  "<tr><td style=\"padding:0 0 16px;word-break:break-word;overflow-wrap:anywhere;\"><p style=\"margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.6;color:#5B6182\">Did not open an account? You can ignore this email. Nobody can use the account until the email is confirmed.</p></td></tr>",
  "<tr><td style=\"padding:22px 0 0;border-top:1px solid #DDD3C2\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:separate;\"><tr><td style=\"padding:0 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\">Alleyne Real Estate · Chattel Village, Holetown, St James, Barbados</td></tr><tr><td style=\"padding:6px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\"><a href=\"tel:+12464321159\" style=\"color:#5B6182;white-space:nowrap\">1 (246) 432-1159</a> · <a href=\"__SITE__\" style=\"color:#5B6182\">__HOST__</a></td></tr><tr><td style=\"padding:6px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.6;color:#5B6182;word-break:break-word;overflow-wrap:anywhere;\">You got this because an account was opened on __HOST__ with this address. If it was not you, ignore this email: the account will not be activated.</td></tr></table></td></tr>",
  "</table>",
  "</td></tr></table>",
  "</body>",
  "</html>",
].join('\n') + '\n';

const trimSite = (site) => String(site || '').replace(/\/+$/, '');
/** "www.example.com" from "https://www.example.com/". */
function hostOf(site) {
  try { return new URL(site).host; } catch { return trimSite(site).replace(/^https?:\/\//, ''); }
}
const fill = (html, site) => html.split('__SITE__').join(trimSite(site)).split('__HOST__').join(hostOf(site));

/** Subject and HTML of each account email for a site. */
function accountTemplates(site) {
  return {
    reset_password: { object: 'Reset your Alleyne Real Estate password', message: fill(RESET_HTML, site) },
    email_confirmation: { object: 'Confirm your email for Alleyne Real Estate', message: fill(CONFIRM_HTML, site) },
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

module.exports = { TEMPLATE_VERSION, accountTemplates, siteConfirmLink, moveSite, nextEmailSettings, hostOf };
