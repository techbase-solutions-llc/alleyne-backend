'use strict';

/**
 * Home page slides (Claude Design handoff, 29 Sep). The site's back office publishes the
 * whole ordered list at once with the server token, after checking the person is an
 * agency member; the site checks and cleans the list first. This is the backstop for any
 * other write path (the admin panel, a script): a malformed list is refused here rather
 * than breaking the public home page.
 */
const { errors } = require('@strapi/utils');
const { slidesProblem } = require('../../../../utils/home-slides');

function check(event) {
  const data = event.params.data || {};
  if (!('slides' in data) || data.slides === null) return;
  const problem = slidesProblem(data.slides);
  if (problem) throw new errors.ApplicationError(problem);
}

module.exports = {
  beforeCreate: check,
  beforeUpdate: check,
};
