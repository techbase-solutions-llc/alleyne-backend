'use strict';
// The website's full-access server token only; every users-permissions role, signed in or not,
// is refused with 403 (client accounts plan, 5 Nov 2026).
const { serverTokenOnly } = require('../../../utils/client-consent');

module.exports = (policyContext) => serverTokenOnly(policyContext);
