# BeatAPI SaaS Template

An open-source TanStack Start template for turning BeatAPI-powered image and
video workflows into a complete SaaS product.

It combines an original BeatAPI marketing experience, authentication,
subscriptions, credits, administration, storage, email, internationalization,
and an integrated creative workspace with guided Studio and node-based Canvas
views.

## What is included

- TanStack Start, React 19, TypeScript, Vite, and Nitro.
- Tailwind CSS 4 with reusable Base UI and shadcn-style primitives.
- Better Auth with email/password, verification, reset, and Google OAuth.
- PostgreSQL and Drizzle ORM with a committed baseline migration.
- Stripe as the default payment provider, with optional provider adapters.
- Credits, subscriptions, API keys, invite codes, RBAC, CMS, and support.
- Cloudflare R2 uploads and generated-output persistence.
- BeatAPI image and video task adapters, polling, callbacks, and recovery.
- English and Chinese localization through Paraglide JS.
- Cloudflare Workers deployment with Hyperdrive and scheduled task recovery.

## Template and workspace boundary

BeatAPI maintains the reusable workbench and the SaaS template as separate
products:

- The workbench owns projects, Studio, Canvas, assets, generation tasks, and
  provider-neutral creative workflow contracts.
- This template owns the commercial application shell: marketing, identity,
  billing, credits, administration, configuration, storage, and deployment.

The integrated workbench in this repository uses the same users, projects,
assets, tasks, and billing state. Studio and Canvas are two views of one
project, not separate backends.

## Recommended production stack

| Layer | Default |
| --- | --- |
| Application | TanStack Start on Cloudflare Workers |
| Database | PostgreSQL through Cloudflare Hyperdrive |
| Authentication | Better Auth |
| Storage | Cloudflare R2 |
| Email | Resend |
| Payments | Stripe |
| AI upstream | BeatAPI |

SQLite is available only as a local test fixture. The public production profile
uses PostgreSQL through Hyperdrive so billing and credit mutations have real
transaction and locking guarantees.

## Quick start

Requirements: Node.js 22+ and pnpm 10.32.1.

```bash
pnpm install
cp .env.example .env.development
pnpm db:setup
pnpm db:push
pnpm effects:seed
pnpm dev
```

Set at least:

```env
VITE_APP_URL=http://localhost:3020
VITE_APP_NAME=BeatAPI
DATABASE_PROVIDER=postgres
DATABASE_URL=<postgres-connection-string>
AUTH_SECRET=<random-secret>
```

Generate the auth secret with `openssl rand -base64 32`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server on port 3020 |
| `pnpm verify` | Run typecheck, tests, i18n validation, and production build |
| `pnpm cf:build` | Build the Cloudflare Workers artifact |
| `pnpm db:push` | Synchronize a development database |
| `pnpm db:generate` | Generate reviewed PostgreSQL migrations |
| `pnpm db:migrate` | Apply committed migrations |
| `pnpm effects:seed` | Seed the generation model catalog |
| `pnpm rbac:init` | Initialize roles and permissions |
| `pnpm licenses:check` | Validate the production license inventory |

## Architecture

```text
Marketing / Auth / Settings / Admin / Billing
                    │
              SaaS application shell
                    │
          Studio / Canvas / Projects
                    │
       Routes and typed server boundaries
                    │
       Business modules and task services
                    │
  Better Auth · PostgreSQL · R2 · Payments · Email · BeatAPI
                    │
          Nitro on Cloudflare Workers
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [PROVIDERS.md](PROVIDERS.md), and
[WORKSPACE_MODES.md](WORKSPACE_MODES.md) for the detailed contracts.

## Template release checklist

Publishing this repository does not require BeatAPI, Stripe, OAuth, email, or
storage credentials, and it does not require a real payment. Template
maintainers verify the reusable code paths with automated tests:

1. Run `pnpm verify`, `pnpm cf:build`, and the production dependency audit.
2. Run the repository security scan and confirm `.env*` files are ignored.
3. Confirm the committed examples contain placeholders only.

## Deploying your fork

Each adopter owns their accounts, secrets, catalog IDs, callback URLs, and
production verification. Before deploying a fork:

1. Generate and review database migrations.
2. Configure production secrets with the hosting provider.
3. Test sign-in and verification email with your own auth and email settings.
4. Test Stripe in your own sandbox before enabling live checkout.
5. Test BeatAPI generation with your own server-side `BEATAPI_API_KEY`.
6. Verify storage, webhook URLs, trusted origins, credits, refunds, and task
   recovery on your final domain.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
