// Fields the website writes that must exist on the content types (audit, 12 Oct 2026).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const schema = (api) => require(path.join(__dirname, "..", "api", api, "content-types", api, "schema.json"));

test("a property submission keeps its ActiveCampaign contact id, as a lead does", () => {
  const lead = schema("lead").attributes.activecampaignContactId;
  assert.deepEqual(lead, { type: "string" });
  assert.deepEqual(schema("property-submission").attributes.activecampaignContactId, lead);
});
