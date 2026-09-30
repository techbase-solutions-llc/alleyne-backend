'use strict';

// Home page slides (29 Sep): the shape a stored slide list must have. Each slide is an
// uploaded picture on https with its width and height, an optional caption (up to 80
// characters) and an optional link (a page on the site, starting with one "/", or a full
// https address). The site sends extra display fields (file size, format, who added it and
// when); they are allowed and bounded.
const MAX_SLIDES = 30;
const MAX_CAPTION = 80;
const MAX_LINK = 300;
const BAD_CHARS = /[\s\\\u0000-\u001f\u007f]/;

const posInt = (n) => Number.isInteger(n) && n > 0 && n <= 20000;

function linkOk(link) {
  if (link === undefined || link === null || link === '') return true;
  if (typeof link !== 'string' || link.length > MAX_LINK || BAD_CHARS.test(link)) return false;
  if (link.startsWith('/')) return !link.startsWith('//');
  if (!link.toLowerCase().startsWith('https://')) return false;
  try {
    const u = new URL(link);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Why a slide list cannot be stored, or null when it can. */
function slidesProblem(slides) {
  if (!Array.isArray(slides)) return 'Slides must be a list.';
  if (slides.length > MAX_SLIDES) return `No more than ${MAX_SLIDES} slides.`;
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const n = i + 1;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return `Slide ${n} is not a slide.`;
    if (typeof s.url !== 'string' || s.url.length > 1000 || !s.url.startsWith('https://')) return `Slide ${n} has no picture address.`;
    if (!posInt(s.width) || !posInt(s.height)) return `Slide ${n} has no picture size.`;
    if (s.caption !== undefined && s.caption !== null && (typeof s.caption !== 'string' || s.caption.length > MAX_CAPTION)) return `Slide ${n} has a caption over ${MAX_CAPTION} characters.`;
    if (!linkOk(s.link)) return `Slide ${n} has a link that would not work.`;
    if (s.addedBy !== undefined && (typeof s.addedBy !== 'string' || s.addedBy.length > 60)) return `Slide ${n} has an unexpected name.`;
    if (s.addedAt !== undefined && (typeof s.addedAt !== 'string' || s.addedAt.length > 40)) return `Slide ${n} has an unexpected date.`;
    if (s.format !== undefined && !['JPG', 'PNG', 'WEBP'].includes(s.format)) return `Slide ${n} has an unexpected format.`;
    if (s.bytes !== undefined && !(Number.isInteger(s.bytes) && s.bytes > 0)) return `Slide ${n} has an unexpected file size.`;
  }
  return null;
}

module.exports = { slidesProblem, MAX_SLIDES };
