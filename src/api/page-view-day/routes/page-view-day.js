"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them. The back office reads the counts with it.
const { createCoreRouter } = require("@strapi/strapi").factories;
module.exports = createCoreRouter("api::page-view-day.page-view-day");
