# Architecture

## Product boundary

BeatAPI SaaS Template is the commercial application shell around the BeatAPI
creative workbench. It owns identity, billing, administration, persistence,
deployment, and the public website. Studio and Canvas are two presentations of
the same project and generation services.

## Layers

```text
React routes and components
        ↓
API routes and server functions
        ↓
Business modules and workspace services
        ↓
Infrastructure contracts
        ↓
Configured provider adapters
```

- `src/routes`: pages, loaders, validation, and HTTP boundaries.
- `src/blocks`: localized, zero-config marketing sections.
- `src/components`: reusable UI and workbench presentation.
- `src/modules`: SaaS business rules such as payments, subscriptions, RBAC,
  API keys, support, and configuration.
- `src/core`: authentication, database, email, storage, payment adapters,
  projects, effects, Studio, and Canvas services.
- `src/config`: environment configuration, pricing, locales, and schema.

Components must not import database clients or provider SDKs. Client API data
is accessed through the typed API client and TanStack Query. Server routes stay
thin and delegate business decisions to services.

## Data model

PostgreSQL is the supported production database. Drizzle provides the schema,
query layer, and committed migrations. Cloudflare Workers connect through
Hyperdrive; direct PostgreSQL is supported for local development and other Node
hosts.

SQLite remains a local test fixture only. Billing and credit mutation paths
require real transactions and locking, so the public production support matrix
is intentionally focused on PostgreSQL.

The accounting model separates durable commercial records from the operational
workspace balance:

- Orders, subscriptions, and the credit grant ledger record commercial events.
- `user_credit` is the current workspace balance projection.
- `credit_transaction` records idempotent workspace deductions, reservations,
  releases, refunds, and projected grants.
- Payment order IDs and generation IDs are used as idempotency references so a
  callback or recovery pass can safely retry projection updates.

## Authentication and authorization

Better Auth owns users, sessions, email/password flows, Google OAuth, email
verification, and password reset. RBAC protects administrative routes in
addition to ordinary session checks. User-owned resources are always scoped by
the authenticated user or verified project membership.

## Payments and credits

Payment adapters normalize checkout creation, signature verification, webhook
events, customers, transactions, and subscription identifiers. Stripe is the
default documented provider. Optional adapters must fail explicitly when they
are not configured.

Webhook events are claimed through a unique provider/external-event key before
fulfillment. Paid-order updates and durable grants run in a database
transaction. Workspace balance projection is idempotent and retryable.

Generation uses reservation semantics:

1. Reserve credits for a unique generation ID.
2. Submit the provider task.
3. Confirm the reservation on success.
4. Release or refund it when creation or processing fails.

## Storage and generation

Cloudflare R2 stores user uploads and generated media. Local inline previews are
size-capped and are not a hosted persistence strategy.

BeatAPI is the default generation upstream. Provider adapters translate the
shared image/video task contract without leaking credentials to the client.
Scheduled recovery polls incomplete generations and reconciles stale tasks.

## Internationalization

Paraglide JS compiles English and Chinese messages. English routes are
unprefixed; Chinese routes use `/zh`. API routes are never localized. Internal
links use the locale-aware navigation wrapper.

## Deployment

The recommended profile is:

```text
Cloudflare Workers
  + Hyperdrive
  + PostgreSQL
  + Cloudflare R2
```

Compilation is only one release gate. A production deployment must also verify
migrations, authentication, email, signed payment webhooks, storage, a real
BeatAPI task, credit reconciliation, and scheduled recovery.
