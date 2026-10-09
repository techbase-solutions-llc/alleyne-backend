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
- Sign-in tries are counted per account tried and caller address. The limiter reads the
  request's `email` field, which the caller could fill with anything; since 8 Oct a step
  before it overwrites `email` with the `identifier` being tried (`src/utils/auth-routes.js`),
  so a new made-up value no longer gives a new allowance. There is no limit per account
  alone: anyone could then lock the owner out by guessing wrong on purpose.
- Not yet checked on the live service. After the deploy, check two things:
  1. The review's check: GETs to `/api/connect/google`, each with a different made-up
     X-Forwarded-For, should get 429 after 10 a minute. This passes whether the address
     counted is the visitor's or a proxy's, so it is not enough on its own.
  2. That the address counted is the caller's own. From connection A (for example office
     broadband), sign in 6 times within 5 minutes with a wrong password for an address
     that has no account, such as `limit-check@example.com`: the 6th answer is 429. Then,
     within the same 5 minutes, try once from connection B (a phone on mobile data, Wi-Fi
     off) with the same address. B should get 400 (wrong details), not 429. If B also gets
     429, Render's edge is adding its own address last and every visitor shares one
     allowance: set `PROXY_IP_HEADER=CF-Connecting-IP` on Render, redeploy and repeat.

## Invitation codes (8 Oct 2026)

- Codes made by `/agency-memberships/invite-code` now start with `inv-`, so the backend can
  tell an invitation code from a forgotten-password one. Removing an invited person deletes
  their account only when their invitation code is still open and the account has no
  favourites or saved searches (`unused` from `invite-code/status`).
- Invitations sent before this deploy carry the old codes: removing one of those keeps the
  account. Resend any still pending, so they carry the new code.
