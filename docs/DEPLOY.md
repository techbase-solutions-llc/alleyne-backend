# Deploying alleyne-backend


## Render (updated 25 Sep 2026)

- Service `srv-da1bfbgu01pc739tivfg` (web, Oregon) deploys automatically on every push to
  `master` of `techbase-solutions-llc/alleyne-backend`.
- Until 25 Sep the service still pointed at the pre-move repo `techbasesolutions/alleyne-backend`,
  so pushes to the new organisation did not deploy (deploys on 24 and 25 Sep were triggered
  by hand). Repointed via the Render API.
- Manual deploy if ever needed: `POST https://api.render.com/v1/services/<id>/deploys`.
- Database `dpg-da1bdogu01pc739tfsn0-a` is on the paid basic_256mb plan (since 17 Sep).

## Client address for rate limits (8 Oct 2026)

- Sign-in, sign-up, password and confirmation-email limits count per caller address. Since
  8 Oct the address is the last X-Forwarded-For entry, the one Render's proxy adds
  (`src/utils/client-ip.js`); before, a caller could write their own and dodge the limit.
- Optional settings, only if Render's setup changes: `PROXY_TRUSTED_HOPS` (default 1) and
  `PROXY_IP_HEADER` (default X-Forwarded-For; for example `CF-Connecting-IP`).
- Not yet checked on the live service: after the deploy, repeat the review's check (GETs to
  `/api/connect/google`, each with a different made-up X-Forwarded-For) and expect 429 after
  10 a minute.
