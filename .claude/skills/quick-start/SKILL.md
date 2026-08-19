---
name: quick-start
description: Build an original BeatAPI SaaS product from a product brief. Configures branding, landing blocks, authentication, billing, workspace features, localization, database, and release checks.
argument-hint: "<product brief and desired features>"
---

# BeatAPI SaaS Quick Start

Turn the user's product brief into an original SaaS application built on this
template. Do not reproduce another product's text, assets, source code, or
distinctive page composition. External material may be used only as general
research after the user confirms they have the right to use it.

## 1. Establish the product contract

Extract or reasonably infer:

- product name, domain, audience, and primary job;
- image/video generation workflows and supported models;
- pricing model, credit unit, plans, and checkout provider;
- required dashboard and admin capabilities;
- locales, tone, visual direction, and launch constraints.

Ask only for a decision that materially changes the implementation and cannot
be inferred safely.

## 2. Configure the environment

Create `.env.development` from `.env.example` when needed. Keep all real
credentials untracked. Public browser values use `VITE_`; server secrets do
not.

Production uses PostgreSQL. SQLite may be selected only for local testing.

```bash
pnpm install
pnpm db:setup
pnpm db:push
pnpm rbac:init
```

Do not invent production credentials or apply production migrations.

## 3. Define original branding and design

Set the application metadata and theme tokens first. Create a coherent visual
system for the product rather than assembling generic cards:

- typography, spacing, color, radius, elevation, and motion;
- original page hierarchy and section composition;
- product-specific diagrams, examples, screenshots, and empty states;
- responsive behavior for desktop, tablet, and mobile;
- reduced-motion and accessible contrast behavior.

Keep durable primitives in `src/components/`. Product content and localization
belong in `src/blocks/` and `messages/{en,zh}.json`.

## 4. Build the product surfaces

Rewrite the landing blocks and `src/routes/index.tsx` around the actual product
story. Wire required authenticated pages under `src/routes/settings/` or the
workspace routes. Keep API routes thin and business rules in `src/modules/` or
the relevant core service.

Use TanStack Query over `@/lib/api-client` for component data. Use TanStack Form
and zod for forms. Add every new translation key to both locales.

## 5. Configure commerce and generation

Connect plan ids, provider price ids, credit grants, limits, and webhook
handling. Preserve idempotency for payment callbacks and generation task
recovery. Do not enable a payment or model provider unless its configuration
and user-facing support matrix agree.

Seed the generation catalog when applicable:

```bash
pnpm effects:seed
```

## 6. Validate

Run the complete release gate:

```bash
pnpm verify
pnpm cf:build
pnpm licenses:check
pnpm audit --prod --audit-level high
```

Also verify the main landing, authentication, pricing, project creation,
Studio, Canvas, account, and admin paths at desktop and mobile widths. Paid
checkout and provider-backed generation need explicit credentials and a
separate end-to-end test.

Before any commit, run the repository `security-scan` skill. Report what was
implemented, what was verified, and what still requires production credentials.
