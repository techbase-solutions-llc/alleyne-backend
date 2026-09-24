# Alleyne backend

Strapi 4.24 backend for the Alleyne Real Estate website and admin dashboard, on Render
(`render.yaml`). The site itself, the Drupal import scripts and the written records live in
the separate `alleyne-real-estate` folder.

## Linear

Linear is Techbase's source of truth. This repo's project is **Alleyne Backend**:
https://linear.app/techbaseltd/project/alleyne-backend-6cdf06a0f915
The site is its sister project, **Alleyne Real Estate Website**:
https://linear.app/techbaseltd/project/alleyne-real-estate-website-17b41ec33c8f

Workspace `linear.app/techbaseltd`, one team `Techbase Solutions LLC`, key `TEC`, no cycles.
The working agreement is the team document "How Techbase uses Linear":
https://linear.app/techbaseltd/document/how-techbase-uses-linear-6514569b9511

- **Every approved plan is an issue, created before execution.** Put `Linear: TEC-NN` on the
  plan file's first line.
- **Every session record names its issue.** This repo keeps no session records or plans; its
  history comes from git, and the plans for this work are in `alleyne-real-estate/docs/`.
- **"What remains" becomes issues**, in the right milestone. Anything the client owes gets the
  `Client action` label and stays in Todo; a call owed gets `Decision`.
- **Commits reference the issue**, `Refs: TEC-NN` in the footer.

Run `/linear-sync` at the end of every session, before the final commit. It reconciles what is
on disk against the Done issues in Linear and reports the difference before changing anything.
Never assume the last sync was complete.
