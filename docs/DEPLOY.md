# Deploying alleyne-backend


## Render (updated 25 Sep 2026)

- Service `srv-da1bfbgu01pc739tivfg` (web, Oregon) deploys automatically on every push to
  `master` of `techbase-solutions-llc/alleyne-backend`.
- Until 25 Sep the service still pointed at the pre-move repo `techbasesolutions/alleyne-backend`,
  so pushes to the new organisation did not deploy (deploys on 24 and 25 Sep were triggered
  by hand). Repointed via the Render API.
- Manual deploy if ever needed: `POST https://api.render.com/v1/services/<id>/deploys`.
- Database `dpg-da1bdogu01pc739tfsn0-a` is on the paid basic_256mb plan (since 17 Sep).
