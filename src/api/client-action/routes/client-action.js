"use strict";
// No role is granted these routes (src/utils/role-permissions.js revokes them on every boot):
// only the website's server token reaches them. The back office records each staff action on a
// client account and reads the history with the same token (client accounts plan, 5 Nov 2026).
// Every route also carries the consent endpoint's policy, so a read-only or custom API token is
// refused too (review, 5 Nov 2026).
const { createCoreRouter } = require("@strapi/strapi").factories;

// A fresh object per route: Strapi adds to each route's config when it registers it.
const serverTokenOnly = () => ({ policies: ["api::client-consent.server-token-only"] });

module.exports = createCoreRouter("api::client-action.client-action", {
  config: {
    find: serverTokenOnly(),
    findOne: serverTokenOnly(),
    create: serverTokenOnly(),
    update: serverTokenOnly(),
    delete: serverTokenOnly(),
  },
});
