"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them. The site saves feedback after its own checks and
// the back office reads and updates it with the same token.
const { createCoreRouter } = require("@strapi/strapi").factories;
module.exports = createCoreRouter("api::site-feedback.site-feedback");
