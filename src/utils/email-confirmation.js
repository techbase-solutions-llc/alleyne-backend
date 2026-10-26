'use strict';
// Email confirmation is on unless EMAIL_CONFIRMATION is "false" (review, 26 Oct): a missing or
// mistyped setting must never let unconfirmed addresses in, because Your requests trusts them.
const emailConfirmationOn = (env) => String(env?.EMAIL_CONFIRMATION ?? '').trim().toLowerCase() !== 'false';

module.exports = { emailConfirmationOn };
