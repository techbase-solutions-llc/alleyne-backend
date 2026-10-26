'use strict';
// Run: npm test
// The plugin extensions load and put the account rules in place (plan section A, 26 Oct 2026;
// TEC-1909), so a wiring mistake fails the tests instead of the next deploy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ext = (name) => require(path.join(__dirname, '..', 'extensions', name, 'strapi-server.js'));

test('users-permissions: register, reset and change-password are wrapped, tokens checked, user lifecycle set', () => {
  const originals = { register: async () => {}, resetPassword: async () => {}, changePassword: async () => {}, callback: async () => {} };
  const jwt = () => ({ verify: async () => ({}), getToken() {} });
  const plugin = {
    routes: { 'content-api': { routes: [{ method: 'POST', path: '/auth/local', handler: 'auth.callback', config: { middlewares: ['plugin::users-permissions.rateLimit'] } }] } },
    services: { jwt },
    controllers: { auth: { ...originals } },
    contentTypes: { user: { schema: {} } },
  };
  const out = ext('users-permissions')(plugin);
  for (const k of ['register', 'resetPassword', 'changePassword']) {
    assert.equal(typeof out.controllers.auth[k], 'function');
    assert.notEqual(out.controllers.auth[k], originals[k], `${k} is wrapped`);
  }
  assert.equal(out.controllers.auth.callback, originals.callback, 'sign-in itself is left alone');
  assert.notEqual(out.services.jwt, jwt);
  assert.equal(typeof out.services.jwt({ strapi: {} }).verify, 'function');
  for (const k of ['beforeUpdate', 'afterUpdate', 'beforeDelete', 'afterDelete', 'beforeDeleteMany', 'afterDeleteMany'])
    assert.equal(typeof out.contentTypes.user.lifecycles[k], 'function', k);
  // The earlier rules are still there.
  assert.equal(typeof out.routes['content-api'].routes[0].config.middlewares[0], 'function', 'sign-in limit key still pinned');
});

test('email: a send with only HTML, or HTML as the text, goes out with a plain-text part', async () => {
  const seen = [];
  const plugin = { services: { email: () => ({ send: async (o) => { seen.push(o); }, getProviderSettings: () => 'x' }) } };
  const svc = ext('email')(plugin).services.email({ strapi: {} });
  const html = '<table><tr><td><h1>Reset your password</h1></td></tr></table>';
  await svc.send({ to: 'a@b.co', html, text: html });
  await svc.send({ to: 'a@b.co', html, text: 'Written by hand' });
  assert.equal(seen[0].text, 'RESET YOUR PASSWORD\n');
  assert.equal(seen[1].text, 'Written by hand');
  assert.equal(svc.getProviderSettings(), 'x', 'the rest of the service is unchanged');
});
