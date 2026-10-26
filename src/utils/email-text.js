// src/utils/email-text.js
'use strict';
// A real plain-text part for every email the backend sends (plan A4, 26 Oct 2026; TEC-1909).
// Strapi's confirmation and reset emails pass their HTML as the text part too, so a mail
// program showing text saw raw markup. Written for the account email layout (one table row
// per block, the footer after a top border, as the website's src/lib/email/blocks.ts makes
// them); any other HTML still comes out readable. Wired in src/extensions/email/strapi-server.js.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

/** One link as text: "label: address" for a button or a worded link; the label alone for a
    phone, an email or a host name; the address alone when it is its own label. */
function linkText(href, label) {
  if (!label) return '';
  if (/^(tel|mailto):/i.test(href) || !href) return label;
  if (label === href || label === hostOf(href)) return label;
  return `${label}: ${href}`;
}

/** The words of one block: inline markup gone, line breaks kept, spaces tidied. */
function inline(html) {
  const s = html
    .replace(/<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, href, inner) =>
      linkText(decode(href).trim(), decode(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()))
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_m, inner) => inner.replace(/<[^>]+>/g, '').toUpperCase())
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decode(s)
    .split('\n')
    .map((l) => l.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** The blocks of a stretch of the layout: one per table row, empty ones left out. */
const blocks = (html) => html.split(/<\/tr>/i).map(inline).filter(Boolean);

/** The email's HTML as plain text, in the website's text style: blocks apart by a blank line,
    then "--" and the footer lines. */
function htmlToText(html) {
  let body = String(html || '');
  const b = body.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  if (b) body = b[1];
  body = body
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script|title)\b[\s\S]*?<\/\1>/gi, '')
    // The preview line mail programs show beside the subject.
    .replace(/<div\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, '');
  const foot = body.search(/<td\b[^>]*style\s*=\s*["'][^"']*border-top/i);
  const main = blocks(foot < 0 ? body : body.slice(0, foot)).join('\n\n');
  const footer = foot < 0 ? '' : blocks(body.slice(foot)).join('\n');
  return (footer ? `${main}\n\n--\n${footer}` : main) + '\n';
}

/** The send options with a text part made from the HTML, when the text is missing or is the
    HTML itself (as Strapi sends it). A text the sender wrote is kept. */
function withPlainText(options) {
  if (!options || typeof options.html !== 'string') return options;
  const text = options.text;
  const needs = typeof text !== 'string' || !text.trim() || text === options.html || /<(html|body|table)\b/i.test(text);
  return needs ? { ...options, text: htmlToText(options.html) } : options;
}

module.exports = { htmlToText, withPlainText };
