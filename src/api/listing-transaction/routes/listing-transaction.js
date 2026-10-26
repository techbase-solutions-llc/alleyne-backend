"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them.
const { createCoreRouter } = require("@strapi/strapi").factories;
module.exports = createCoreRouter("api::listing-transaction.listing-transaction");
