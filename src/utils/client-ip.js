// src/utils/client-ip.js
'use strict';

/**
 * Which address is the caller's, behind Render (review, 8 Oct 2026). With proxy: true Koa
 * takes the leftmost X-Forwarded-For entry, which the caller writes: a different made-up
 * address on every request dodged the sign-in rate limit. Render's proxy appends the
 * address it saw to whatever the caller sent, so the last entry is the one to trust.
 *
 * Strapi 4.24 builds its Koa app with only { proxy, keys } (services/server/koa.js), so the
 * setting is put on strapi.server.app, which Koa reads on every request.
 * PROXY_TRUSTED_HOPS (default 1) and PROXY_IP_HEADER (default X-Forwarded-For) change it
 * without a code change if Render's setup ever differs.
 */
function trustLastProxyHop(app, env = process.env) {
  const hops = parseInt(env.PROXY_TRUSTED_HOPS, 10);
  app.maxIpsCount = Number.isInteger(hops) && hops > 0 ? hops : 1;
  if (env.PROXY_IP_HEADER) app.proxyIpHeader = env.PROXY_IP_HEADER;
  return app;
}

module.exports = { trustLastProxyHop };
