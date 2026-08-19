---
name: deploy-cloudflare
description: Deploy BeatAPI SaaS Template to Cloudflare Workers with PostgreSQL through Hyperdrive. Use for Cloudflare deployment, redeployment, secrets, migrations, and production smoke checks.
---

# Deploy to Cloudflare Workers

Deploy the TanStack Start application to Cloudflare Workers. Production uses
PostgreSQL through a Cloudflare Hyperdrive binding. SQLite is only a local test
fixture and must never be selected for a production deployment.

## Safety rules

- Treat `wrangler.example.jsonc` as the committed template and `wrangler.jsonc`
  as the gitignored working configuration.
- Never print, commit, or place secrets in `vars`.
- Run production migrations directly against the PostgreSQL connection string;
  migration tools do not connect through Hyperdrive.
- Generate and review migrations before applying them.
- Reuse existing Workers and Hyperdrive resources on repeat deployments.
- Do not change DNS, custom domains, or production data unless the user asked.

## 1. Preflight

From the repository root, verify the working tree and required files:

```bash
git status --short
test -f wrangler.example.jsonc
test -f package.json
test -f src/server.ts
npx wrangler whoami
```

If `wrangler.jsonc` does not exist, copy it from `wrangler.example.jsonc` and
keep it untracked. Confirm its `vars.DATABASE_PROVIDER` is `postgresql` and its
Hyperdrive binding name matches the application runtime.

## 2. Validate the release

Run all local release gates before changing production:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm cf:build
pnpm licenses:check
pnpm audit --prod --audit-level high
```

Stop on any failure. Do not deploy a build with high-severity production
dependency findings.

## 3. Prepare PostgreSQL and Hyperdrive

Obtain the direct PostgreSQL URL from the user's configured environment. Do not
echo it. Inspect existing Hyperdrive resources first:

```bash
npx wrangler hyperdrive list
```

If a suitable resource already exists, reuse its id in `wrangler.jsonc`. If the
user authorized first-time infrastructure setup, create one with Wrangler and
place the returned id in the gitignored working configuration.

The Worker uses Hyperdrive at runtime. Schema generation, migrations, RBAC
initialization, and admin assignment use `DATABASE_PROVIDER=postgresql` plus the
direct `DATABASE_URL` in the local process.

## 4. Generate and review migrations

For a schema change:

```bash
DATABASE_PROVIDER=postgresql pnpm db:setup
DATABASE_PROVIDER=postgresql pnpm db:generate
```

Review every generated SQL file. Call out destructive statements such as
`DROP TABLE`, `DROP COLUMN`, data type narrowing, or irreversible rewrites. Ask
the user to approve a destructive production migration before applying it.

Apply reviewed migrations:

```bash
DATABASE_PROVIDER=postgresql pnpm db:migrate
```

Initialize roles only after the schema is current:

```bash
DATABASE_PROVIDER=postgresql pnpm rbac:init
```

Assign an admin only when the user supplied the exact account identifier and
explicitly requested the assignment.

## 5. Configure Worker secrets

Inspect configured secret names without reading their values:

```bash
npx wrangler secret list
```

Set required values through standard input with `wrangler secret put`. Typical
production secrets include `AUTH_SECRET`, provider credentials, and
`CONFIG_ENCRYPTION_KEY`. Keep `CONFIG_ENCRYPTION_KEY` stable because rotating or
removing it makes existing encrypted settings unreadable.

Public values such as the application URL belong in `wrangler.jsonc` `vars`.
Credentials and database URLs do not.

## 6. Build and deploy

Build once more with the production provider selected, then deploy:

```bash
DATABASE_PROVIDER=postgresql pnpm cf:build
pnpm cf:deploy
```

Capture the deployed Worker URL and deployment version. Do not claim success
from command exit status alone.

## 7. Smoke test

Verify at minimum:

- homepage returns a successful response;
- sign-in page renders;
- localized route renders;
- an unauthenticated protected API request is rejected;
- static assets load from the deployed origin;
- Worker logs show no database or binding errors.

When production credentials and a disposable account are available, verify
sign-in, dashboard loading, and a read-only database-backed request. Payment
webhooks and paid checkout require a separate explicitly authorized end-to-end
test.

## Handoff

Report the deployed URL, Worker name, Hyperdrive resource used, migration files
applied, validation results, and anything intentionally not tested. Never
include secret values or direct database URLs in the report.
