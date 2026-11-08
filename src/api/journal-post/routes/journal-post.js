"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them. The website reads published posts and the back
// office writes drafts, publishes and schedules them with the same token, after checking the
// staff member's journal permission (TEC-2138).
const { createCoreRouter } = require("@strapi/strapi").factories;
module.exports = createCoreRouter("api::journal-post.journal-post");
