"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them. The back office records each staff action on a
// client account and reads the history with the same token (client accounts plan, 5 Nov 2026).
const { createCoreRouter } = require("@strapi/strapi").factories;
module.exports = createCoreRouter("api::client-action.client-action");
